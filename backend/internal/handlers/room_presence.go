package handlers

// Study Rooms: live presence (virtual desks) and shared focus sessions.
//
// Presence design: one document per (roomId,userId), updated in place by a 30s
// heartbeat and removed automatically by a Mongo TTL index on expiresAt. Absence
// of a document *is* offline, so a crashed client cannot appear online forever
// and no cleanup job is needed. Realtime events are emitted only when a member's
// state actually changes, which is the single largest reduction in event traffic
// available — a room of 50 quietly studying members produces no events at all.

import (
	"context"
	"errors"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/realtime"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const maxPresenceDesks = 100

// GetRoomPresence returns the virtual desks: who is at their desk right now,
// what state they are in, and how long they have been focused.
func GetRoomPresence(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	// Sort on the indexed expiresAt only. Sorting by state first was unindexed,
	// which forced a blocking in-memory sort and — worse — the 100-document limit
	// then truncated by alphabetical state, dropping exactly the "studying"
	// members the desks exist to show.
	cursor, err := config.DB.Collection(roomPresenceCollection).Find(ctx,
		bson.M{"roomId": rc.Room.ID, "expiresAt": bson.M{"$gt": now}},
		options.Find().SetSort(bson.D{{Key: "expiresAt", Value: -1}}).
			SetLimit(maxPresenceDesks))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var presences []models.RoomPresence
	if err := cursor.All(ctx, &presences); err != nil {
		return serverError(c)
	}

	userIDs := make([]primitive.ObjectID, 0, len(presences))
	for _, presence := range presences {
		userIDs = append(userIDs, presence.UserID)
	}
	summaries, err := loadUserSummaries(ctx, userIDs)
	if err != nil {
		return serverError(c)
	}

	desks := make([]fiber.Map, 0, len(presences))
	studying := 0
	for _, presence := range presences {
		if !models.IsPresenceLive(presence, now) {
			continue
		}
		if presence.State == models.PresenceStudying || presence.State == models.PresenceDeepFocus {
			studying++
		}
		desks = append(desks, fiber.Map{
			"user":             summaries[presence.UserID],
			"state":            presence.State,
			"focusMinutes":     presence.FocusMinutes,
			"sessionStartedAt": presence.SessionStartedAt,
			"updatedAt":        presence.UpdatedAt,
		})
	}
	return c.JSON(fiber.Map{
		"desks": desks, "liveCount": len(desks), "studyingCount": studying,
		"heartbeatSeconds": int(models.PresenceHeartbeatInterval.Seconds()),
	})
}

// UpsertRoomPresence is the heartbeat. It is idempotent and cheap: one upsert on
// a unique index, and a realtime event only when the state transitions.
func UpsertRoomPresence(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	var body struct {
		State        string `json:"state"`
		FocusMinutes int    `json:"focusMinutes"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}
	if !models.IsValidPresenceState(body.State) {
		return badRequest(c, models.ErrPresenceState.Error())
	}
	// Clamp rather than reject: a client clock drifting or a long-running tab
	// should not fail the heartbeat, but it must not be able to claim 40 hours.
	if body.FocusMinutes < 0 {
		body.FocusMinutes = 0
	}
	if body.FocusMinutes > models.SessionMaxMinutes {
		body.FocusMinutes = models.SessionMaxMinutes
	}

	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var previous models.RoomPresence
	previousErr := config.DB.Collection(roomPresenceCollection).
		FindOne(ctx, bson.M{"roomId": rc.Room.ID, "userId": user.ID}).Decode(&previous)
	stateChanged := previousErr != nil || previous.State != body.State ||
		!models.IsPresenceLive(previous, now)

	set := bson.M{
		"state": body.State, "focusMinutes": body.FocusMinutes,
		"updatedAt": now, "expiresAt": models.PresenceExpiry(now),
	}
	if body.State == models.PresenceStudying || body.State == models.PresenceDeepFocus {
		if stateChanged || previous.SessionStartedAt == nil {
			set["sessionStartedAt"] = now
		}
	} else {
		set["sessionStartedAt"] = nil
	}

	_, err := config.DB.Collection(roomPresenceCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": user.ID},
		bson.M{"$set": set, "$setOnInsert": bson.M{"roomId": rc.Room.ID, "userId": user.ID}},
		options.Update().SetUpsert(true))
	if err != nil {
		return serverError(c)
	}
	_, _ = config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": user.ID},
		bson.M{"$set": bson.M{"lastSeenAt": now}})

	if stateChanged {
		realtime.NotifyRoom(rc.Room.ID.Hex(), "room:presence")
	}
	return c.JSON(fiber.Map{
		"state": body.State, "expiresAt": models.PresenceExpiry(now),
		"heartbeatSeconds": int(models.PresenceHeartbeatInterval.Seconds()),
	})
}

// CreateRoomSession hosts a shared session. Start time is server-authoritative:
// clients render a countdown from startsAt so members are genuinely synchronized
// rather than each running their own timer.
func CreateRoomSession(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	var body struct {
		Mode           string `json:"mode"`
		Topic          string `json:"topic"`
		PlannedMinutes int    `json:"plannedMinutes"`
		StartDelaySecs int    `json:"startDelaySeconds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}
	topic, err := models.ValidateSessionInput(body.Mode, body.PlannedMinutes, body.Topic)
	if err != nil {
		return badRequest(c, err.Error())
	}
	// A short lobby delay lets others join before the clock starts; bounded so a
	// session cannot be parked far in the future and hold the "active" slot.
	delay := body.StartDelaySecs
	if delay < 0 {
		delay = 0
	}
	if delay > 600 {
		delay = 600
	}

	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	// One live session per room: concurrent shared sessions would split the room
	// and make "studying together" meaningless.
	existing := config.DB.Collection(roomSessionsCollection).FindOne(ctx, bson.M{
		"roomId": rc.Room.ID, "endsAt": bson.M{"$gt": now},
	})
	if existing.Err() == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "A session is already running in this room",
			"message": "A session is already running in this room",
		})
	} else if !errors.Is(existing.Err(), mongo.ErrNoDocuments) {
		return serverError(c)
	}

	startsAt := now.Add(time.Duration(delay) * time.Second)
	session := models.RoomSession{
		ID: primitive.NewObjectID(), RoomID: rc.Room.ID, HostID: user.ID,
		Mode: body.Mode, Topic: topic, PlannedMinutes: body.PlannedMinutes,
		StartsAt: startsAt, EndsAt: startsAt.Add(time.Duration(body.PlannedMinutes) * time.Minute),
		Status: models.SessionStatusScheduled, CreatedAt: now, UpdatedAt: now,
	}
	if _, err := config.DB.Collection(roomSessionsCollection).InsertOne(ctx, session); err != nil {
		return serverError(c)
	}
	_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx, bson.M{"_id": rc.Room.ID},
		bson.M{"$inc": bson.M{"sessionsHosted": 1}, "$set": bson.M{"lastActivityAt": now}})
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:session")

	return c.Status(fiber.StatusCreated).JSON(sessionResponse(session, nil, nil, now))
}

func sessionResponse(session models.RoomSession, participants []models.RoomSessionParticipant,
	summaries map[primitive.ObjectID]userSummary, now time.Time) fiber.Map {
	items := make([]fiber.Map, 0, len(participants))
	for _, participant := range participants {
		entry := fiber.Map{
			"declaredGoal": participant.DeclaredGoal, "declaredTopic": participant.DeclaredTopic,
			"declaredMinutes": participant.DeclaredMins, "outcome": participant.Outcome,
			"actualMinutes": participant.ActualMinutes, "xpAwarded": participant.XPAwarded,
		}
		if summaries != nil {
			entry["user"] = summaries[participant.UserID]
		}
		items = append(items, entry)
	}
	return fiber.Map{
		"id": session.ID.Hex(), "roomId": session.RoomID.Hex(), "hostId": session.HostID.Hex(),
		"mode": session.Mode, "topic": session.Topic, "plannedMinutes": session.PlannedMinutes,
		"startsAt": session.StartsAt, "endsAt": session.EndsAt,
		// Status is derived from the clock, never trusted from storage, so a
		// missed job cannot leave a session "active" forever.
		"status": models.SessionStatusAt(session, now), "participantCount": session.ParticipantCount,
		"completedCount": session.CompletedCount, "participants": items,
	}
}

// GetActiveRoomSession returns the current or upcoming session with its
// participants, or a null session when the room is idle.
func GetActiveRoomSession(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var session models.RoomSession
	err := config.DB.Collection(roomSessionsCollection).FindOne(ctx,
		bson.M{"roomId": rc.Room.ID, "endsAt": bson.M{"$gt": now}},
		options.FindOne().SetSort(bson.D{{Key: "startsAt", Value: 1}})).Decode(&session)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return c.JSON(fiber.Map{"session": nil})
	}
	if err != nil {
		return serverError(c)
	}

	cursor, err := config.DB.Collection(roomParticipantsCollection).Find(ctx,
		bson.M{"sessionId": session.ID}, options.Find().SetLimit(maxPresenceDesks))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var participants []models.RoomSessionParticipant
	if err := cursor.All(ctx, &participants); err != nil {
		return serverError(c)
	}
	userIDs := make([]primitive.ObjectID, 0, len(participants))
	for _, participant := range participants {
		userIDs = append(userIDs, participant.UserID)
	}
	summaries, err := loadUserSummaries(ctx, userIDs)
	if err != nil {
		return serverError(c)
	}
	return c.JSON(fiber.Map{"session": sessionResponse(session, participants, summaries, now)})
}

// JoinRoomSession records the accountability declaration (goal, topic, minutes)
// before the work starts, which is what makes the later outcome meaningful.
func JoinRoomSession(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	sessionID, err := primitive.ObjectIDFromHex(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "Invalid session ID")
	}
	var body struct {
		DeclaredGoal    string `json:"declaredGoal"`
		DeclaredTopic   string `json:"declaredTopic"`
		DeclaredMinutes int    `json:"declaredMinutes"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}

	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var session models.RoomSession
	err = config.DB.Collection(roomSessionsCollection).
		FindOne(ctx, bson.M{"_id": sessionID, "roomId": rc.Room.ID}).Decode(&session)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}
	if models.SessionStatusAt(session, now) == models.SessionStatusEnded {
		return badRequest(c, "This session has already ended")
	}

	declaredMinutes := body.DeclaredMinutes
	if declaredMinutes <= 0 {
		declaredMinutes = session.PlannedMinutes
	}
	goal, err := models.ValidateSessionInput(session.Mode, declaredMinutes, body.DeclaredGoal)
	if err != nil {
		return badRequest(c, err.Error())
	}
	topic, err := models.ValidateSessionInput(session.Mode, declaredMinutes, body.DeclaredTopic)
	if err != nil {
		return badRequest(c, err.Error())
	}

	participant := models.RoomSessionParticipant{
		SessionID: sessionID, RoomID: rc.Room.ID, UserID: user.ID,
		DeclaredGoal: goal, DeclaredTopic: topic, DeclaredMins: declaredMinutes,
		JoinedAt: now,
	}
	result, err := config.DB.Collection(roomParticipantsCollection).UpdateOne(ctx,
		bson.M{"sessionId": sessionID, "userId": user.ID},
		bson.M{
			"$setOnInsert": bson.M{
				"sessionId": sessionID, "roomId": rc.Room.ID, "userId": user.ID, "joinedAt": now,
				"actualMinutes": 0, "xpAwarded": 0,
			},
			"$set": bson.M{
				"declaredGoal": participant.DeclaredGoal, "declaredTopic": participant.DeclaredTopic,
				"declaredMinutes": participant.DeclaredMins,
			},
		},
		options.Update().SetUpsert(true))
	if err != nil {
		return serverError(c)
	}
	if result.UpsertedCount == 1 {
		_, _ = config.DB.Collection(roomSessionsCollection).UpdateOne(ctx, bson.M{"_id": sessionID},
			bson.M{"$inc": bson.M{"participantCount": 1}, "$set": bson.M{"updatedAt": now}})
		realtime.NotifyRoom(rc.Room.ID.Hex(), "room:session")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"joined": true})
}

// CompleteRoomSession records the outcome and awards XP. XP is computed from the
// pure SessionXP table and is written once: a resubmission cannot farm XP.
func CompleteRoomSession(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	sessionID, err := primitive.ObjectIDFromHex(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "Invalid session ID")
	}
	var body struct {
		Outcome       string `json:"outcome"`
		ActualMinutes int    `json:"actualMinutes"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}
	if !models.IsValidSessionOutcome(body.Outcome) {
		return badRequest(c, models.ErrSessionOutcome.Error())
	}

	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var session models.RoomSession
	err = config.DB.Collection(roomSessionsCollection).
		FindOne(ctx, bson.M{"_id": sessionID, "roomId": rc.Room.ID}).Decode(&session)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}

	// A session that has not started yet cannot have produced study time, and
	// accepting an outcome early would hand out the completion bonus for nothing.
	if models.SessionStatusAt(session, now) == models.SessionStatusScheduled {
		return badRequest(c, "This session has not started yet")
	}

	// Credited minutes can never exceed what this participant could physically
	// have worked: the window from when THEY joined (not when the session
	// started) up to now, and never more than the planned length. Measuring from
	// session.StartsAt would let a late joiner claim the whole session.
	var participation models.RoomSessionParticipant
	partErr := config.DB.Collection(roomParticipantsCollection).
		FindOne(ctx, bson.M{"sessionId": sessionID, "userId": user.ID}).Decode(&participation)
	if partErr != nil {
		if errors.Is(partErr, mongo.ErrNoDocuments) {
			return badRequest(c, "Join the session before recording an outcome")
		}
		return serverError(c)
	}

	actual := body.ActualMinutes
	if actual < 0 {
		actual = 0
	}
	// The clock stops at the session end, so reporting an hour late cannot
	// inflate the credit.
	measuredUntil := now
	if measuredUntil.After(session.EndsAt) {
		measuredUntil = session.EndsAt
	}
	windowStart := participation.JoinedAt
	if windowStart.Before(session.StartsAt) {
		windowStart = session.StartsAt
	}
	elapsed := int(measuredUntil.Sub(windowStart).Minutes()) + 1
	if elapsed < 0 {
		elapsed = 0
	}
	ceiling := session.PlannedMinutes
	if elapsed < ceiling {
		ceiling = elapsed
	}
	if actual > ceiling {
		actual = ceiling
	}
	xp := models.SessionXP(body.Outcome, actual)

	// Only an un-completed participation is updated: the filter on
	// outcome:"" makes the award idempotent under retries and double-taps.
	updateResult, err := config.DB.Collection(roomParticipantsCollection).UpdateOne(ctx,
		bson.M{"sessionId": sessionID, "userId": user.ID, "$or": []bson.M{
			{"outcome": ""}, {"outcome": bson.M{"$exists": false}},
		}},
		bson.M{"$set": bson.M{
			"outcome": body.Outcome, "actualMinutes": actual,
			"xpAwarded": xp, "completedAt": now,
		}})
	if err != nil {
		return serverError(c)
	}
	if updateResult.MatchedCount == 0 {
		// Participation exists (checked above), so a miss here means the outcome
		// was already recorded. XP is therefore awarded at most once.
		return badRequest(c, "This session outcome was already recorded")
	}

	completedIncrement := 0
	if body.Outcome == models.SessionOutcomeCompleted {
		completedIncrement = 1
	}
	_, _ = config.DB.Collection(roomSessionsCollection).UpdateOne(ctx, bson.M{"_id": sessionID},
		bson.M{"$inc": bson.M{"completedCount": completedIncrement}, "$set": bson.M{"updatedAt": now}})
	_, _ = config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": user.ID},
		bson.M{"$inc": bson.M{
			"studyMinutes": actual, "xp": xp, "sessionsCompleted": completedIncrement,
		}, "$set": bson.M{"lastSeenAt": now}})
	_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx, bson.M{"_id": rc.Room.ID},
		bson.M{"$inc": bson.M{"totalStudyMinutes": actual}, "$set": bson.M{"lastActivityAt": now}})
	// Room XP also counts toward the global points the rest of the app shows.
	_, _ = config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID},
		bson.M{"$inc": bson.M{"totalPoints": xp}})

	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:session")
	realtime.NotifyChange(user.ID.Hex(), "leaderboard")

	return c.JSON(fiber.Map{
		"outcome": body.Outcome, "actualMinutes": actual, "xpAwarded": xp,
		"level": models.LevelForXP(xp),
	})
}
