package handlers

// Study Rooms: rooms, discovery and membership.
//
// Authorization contract used by every room handler in this package:
//   - loadRoomContext resolves the room AND the caller's membership in one place.
//   - Private rooms are reported as 404 to non-members so they are not
//     enumerable by ID.
//   - Banned members are treated as non-members for reads and writes.
// Validation and role rules live in models/room.go as pure functions.

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
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

const (
	roomsCollectionName        = "study_rooms"
	roomMembersCollection      = "room_members"
	roomPresenceCollection     = "room_presence"
	roomSessionsCollection     = "room_sessions"
	roomParticipantsCollection = "room_session_participants"
	roomMessagesCollection     = "room_messages"

	defaultRoomLimit = 20
	maxRoomLimit     = 50
	maxRoomsOwned    = 20
	dbTimeout        = 10 * time.Second
)

var errRoomNotVisible = errors.New("room not visible")

func roomForbidden(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": message, "message": message})
}

func roomNotFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Room not found", "message": "Room not found"})
}

// userSummary is the only user shape rooms expose. It deliberately omits email
// and every private field so a room roster can never leak account data.
type userSummary struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Username   string `json:"username"`
	Avatar     string `json:"avatar,omitempty"`
	AvatarType string `json:"avatarType,omitempty"`
}

func summarizeUser(user models.User) userSummary {
	return userSummary{
		ID: user.ID.Hex(), Name: user.Name, Username: user.Username,
		Avatar: user.Avatar, AvatarType: user.AvatarType,
	}
}

// loadUserSummaries batches the user lookup for a set of IDs. Every list
// endpoint in this package uses it so member/chat/leaderboard responses cost one
// extra query instead of one per row (the N+1 shape we must avoid).
func loadUserSummaries(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]userSummary, error) {
	summaries := make(map[primitive.ObjectID]userSummary, len(ids))
	if len(ids) == 0 {
		return summaries, nil
	}
	unique := make([]primitive.ObjectID, 0, len(ids))
	seen := make(map[primitive.ObjectID]struct{}, len(ids))
	for _, id := range ids {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	projection := options.Find().SetProjection(bson.M{"name": 1, "username": 1, "avatar": 1, "avatarType": 1})
	cursor, err := config.DB.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": unique}}, projection)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}
	for _, user := range users {
		summaries[user.ID] = summarizeUser(user)
	}
	return summaries, nil
}

// roomContext is the resolved room plus the caller's standing in it.
type roomContext struct {
	Room   models.StudyRoom
	Member *models.RoomMember
	Role   string
}

func (rc roomContext) isMember() bool {
	return rc.Member != nil && rc.Member.Status == models.RoomMemberActive
}

func (rc roomContext) isBanned() bool {
	return rc.Member != nil && rc.Member.Status == models.RoomMemberBanned
}

// loadRoomContext fetches the room and the caller's membership, enforcing
// visibility. Non-members of a private room get errRoomNotVisible, which callers
// surface as 404.
func loadRoomContext(ctx context.Context, roomID, userID primitive.ObjectID) (roomContext, error) {
	var room models.StudyRoom
	if err := config.DB.Collection(roomsCollectionName).FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err != nil {
		return roomContext{}, err
	}

	var member models.RoomMember
	err := config.DB.Collection(roomMembersCollection).
		FindOne(ctx, bson.M{"roomId": roomID, "userId": userID}).Decode(&member)
	switch {
	case err == nil:
		result := roomContext{Room: room, Member: &member, Role: member.Role}
		if member.Status != models.RoomMemberActive {
			result.Role = ""
		}
		if member.Status == models.RoomMemberBanned && room.Visibility == models.RoomVisibilityPrivate {
			return roomContext{}, errRoomNotVisible
		}
		return result, nil
	case errors.Is(err, mongo.ErrNoDocuments):
		if room.Visibility == models.RoomVisibilityPrivate {
			return roomContext{}, errRoomNotVisible
		}
		return roomContext{Room: room}, nil
	default:
		return roomContext{}, err
	}
}

// requireRoomMember resolves the room and rejects anyone who may not read it.
// Every member-only handler starts with this call.
func requireRoomMember(c *fiber.Ctx) (roomContext, models.User, bool) {
	user := c.Locals("user").(models.User)
	roomID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		_ = badRequest(c, "Invalid room ID")
		return roomContext{}, user, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	rc, err := loadRoomContext(ctx, roomID, user.ID)
	switch {
	case errors.Is(err, mongo.ErrNoDocuments), errors.Is(err, errRoomNotVisible):
		_ = roomNotFound(c)
		return roomContext{}, user, false
	case err != nil:
		_ = serverError(c)
		return roomContext{}, user, false
	}
	if rc.isBanned() {
		_ = roomForbidden(c, "You have been removed from this room")
		return roomContext{}, user, false
	}
	if !rc.isMember() {
		_ = roomForbidden(c, "Join this room first")
		return roomContext{}, user, false
	}
	return rc, user, true
}

// requireWritableRoomMember additionally refuses writes to an archived room.
// Reads stay available so members can still see their history, but an archived
// room must not accept new chat, sessions, presence or edits.
func requireWritableRoomMember(c *fiber.Ctx) (roomContext, models.User, bool) {
	rc, user, ok := requireRoomMember(c)
	if !ok {
		return rc, user, false
	}
	if rc.Room.Archived {
		_ = roomForbidden(c, "This room is archived")
		return roomContext{}, user, false
	}
	return rc, user, true
}

func generateInviteCode() (string, error) {
	buffer := make([]byte, 8)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

// roomResponse shapes a room for the client, including viewer-specific fields so
// the UI never has to guess what the caller may do.
func roomResponse(room models.StudyRoom, rc *roomContext, user models.User) fiber.Map {
	payload := fiber.Map{
		"id":                room.ID.Hex(),
		"name":              room.Name,
		"slug":              room.Slug,
		"description":       room.Description,
		"category":          room.Category,
		"tags":              room.Tags,
		"rules":             room.Rules,
		"coverImageUrl":     room.CoverImageURL,
		"visibility":        room.Visibility,
		"ownerId":           room.OwnerID.Hex(),
		"goal":              room.Goal,
		"requirements":      room.Requirements,
		"memberCount":       room.MemberCount,
		"totalStudyMinutes": room.TotalStudyMinutes,
		"sessionsHosted":    room.SessionsHosted,
		"messageCount":      room.MessageCount,
		"archived":          room.Archived,
		"lastActivityAt":    room.LastActivityAt,
		"createdAt":         room.CreatedAt,
	}
	role := ""
	isMember := false
	if rc != nil {
		role = rc.Role
		isMember = rc.isMember()
	}
	payload["viewerRole"] = role
	payload["isMember"] = isMember
	payload["canModerate"] = models.CanModerate(role)
	payload["canAdminister"] = models.CanAdministerRoom(role)
	if !isMember {
		eligible, reasons := models.MeetsEntryRequirements(room.Requirements, user)
		if room.Visibility != models.RoomVisibilityElite {
			eligible, reasons = true, nil
		}
		payload["eligible"] = eligible
		payload["ineligibleReasons"] = reasons
	}
	return payload
}

func parseRoomLimit(raw string) int64 {
	limit, err := strconv.Atoi(raw)
	if err != nil || limit <= 0 {
		return defaultRoomLimit
	}
	if limit > maxRoomLimit {
		return maxRoomLimit
	}
	return int64(limit)
}

// CreateRoom creates a room and makes the caller its owner in the same request.
func CreateRoom(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var input models.RoomInput
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Invalid request")
	}

	now := time.Now().UTC()
	clean, err := models.ValidateRoomInput(input, now)
	if err != nil {
		return badRequest(c, err.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	// Cap rooms per owner: room creation is cheap for an attacker and
	// permanently costly for discovery.
	owned, err := config.DB.Collection(roomsCollectionName).
		CountDocuments(ctx, bson.M{"ownerId": user.ID, "archived": false})
	if err != nil {
		return serverError(c)
	}
	if owned >= maxRoomsOwned {
		return badRequest(c, "You already own the maximum number of active rooms")
	}

	room := models.StudyRoom{
		ID:             primitive.NewObjectID(),
		Name:           clean.Name,
		Description:    clean.Description,
		Category:       clean.Category,
		Tags:           clean.Tags,
		Rules:          clean.Rules,
		CoverImageURL:  clean.CoverImageURL,
		Visibility:     clean.Visibility,
		OwnerID:        user.ID,
		Goal:           clean.Goal,
		Requirements:   clean.Requirements,
		MemberCount:    1,
		LastActivityAt: now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	room.Slug = models.Slugify(clean.Name) + "-" + room.ID.Hex()[18:]
	if clean.Visibility == models.RoomVisibilityPrivate {
		code, codeErr := generateInviteCode()
		if codeErr != nil {
			return serverError(c)
		}
		room.InviteCode = code
	}

	if _, err := config.DB.Collection(roomsCollectionName).InsertOne(ctx, room); err != nil {
		return serverError(c)
	}
	owner := models.RoomMember{
		RoomID: room.ID, UserID: user.ID, Role: models.RoomRoleOwner,
		Status: models.RoomMemberActive, JoinedAt: now, LastSeenAt: now,
	}
	if _, err := config.DB.Collection(roomMembersCollection).InsertOne(ctx, owner); err != nil {
		// Roll back the room so a failed membership insert cannot leave an
		// ownerless room that nobody can administer or delete.
		_, _ = config.DB.Collection(roomsCollectionName).DeleteOne(ctx, bson.M{"_id": room.ID})
		return serverError(c)
	}

	rc := roomContext{Room: room, Member: &owner, Role: owner.Role}
	response := roomResponse(room, &rc, user)
	if room.InviteCode != "" {
		response["inviteCode"] = room.InviteCode
	}
	return c.Status(fiber.StatusCreated).JSON(response)
}

// GetRooms is discovery. Private rooms are never listed; archived rooms are
// hidden. Pagination is cursor-based on _id so deep pages do not scan.
func GetRooms(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	filter := bson.M{
		"archived":   false,
		"visibility": bson.M{"$ne": models.RoomVisibilityPrivate},
	}
	if category := strings.ToLower(strings.TrimSpace(c.Query("category"))); category != "" {
		if !models.IsValidRoomCategory(category) {
			return badRequest(c, "Invalid category")
		}
		filter["category"] = category
	}
	if visibility := strings.ToLower(strings.TrimSpace(c.Query("visibility"))); visibility != "" {
		if !models.IsValidRoomVisibility(visibility) || visibility == models.RoomVisibilityPrivate {
			return badRequest(c, "Invalid visibility")
		}
		filter["visibility"] = visibility
	}
	if tag := strings.ToLower(strings.TrimSpace(c.Query("tag"))); tag != "" {
		normalized := models.NormalizeTags([]string{tag})
		if len(normalized) == 1 {
			filter["tags"] = normalized[0]
		}
	}
	if query := strings.TrimSpace(c.Query("q")); query != "" {
		if len(query) > 80 {
			query = query[:80]
		}
		// Anchored, escaped prefix match: a user-supplied regex must not be able
		// to run an unanchored scan or a catastrophic backtracking pattern.
		filter["name"] = bson.M{"$regex": "^" + regexQuoteMeta(query), "$options": "i"}
	}

	// Cursor pagination is only sound when the sort key is the cursor key.
	// Paginating a memberCount/hours sort with an _id cursor would skip and
	// repeat rows, so those sorts return a single ranked page instead of a
	// broken "load more".
	sortKey := c.Query("sort")
	cursorPaginated := sortKey == "" || sortKey == "new" || sortKey == "active"
	sort := bson.D{{Key: "lastActivityAt", Value: -1}, {Key: "_id", Value: -1}}
	switch sortKey {
	case "members":
		sort = bson.D{{Key: "memberCount", Value: -1}, {Key: "_id", Value: -1}}
	case "hours":
		sort = bson.D{{Key: "totalStudyMinutes", Value: -1}, {Key: "_id", Value: -1}}
	case "new":
		sort = bson.D{{Key: "_id", Value: -1}}
	}

	limit := parseRoomLimit(c.Query("limit"))
	if before := strings.TrimSpace(c.Query("before")); before != "" {
		if !cursorPaginated {
			return badRequest(c, "This sort order does not support pagination")
		}
		cursorID, err := primitive.ObjectIDFromHex(before)
		if err != nil {
			return badRequest(c, "Invalid pagination cursor")
		}
		filter["_id"] = bson.M{"$lt": cursorID}
		// The cursor key must be the sort key for the walk to be complete.
		sort = bson.D{{Key: "_id", Value: -1}}
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	cursor, err := config.DB.Collection(roomsCollectionName).
		Find(ctx, filter, options.Find().SetSort(sort).SetLimit(limit))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var rooms []models.StudyRoom
	if err := cursor.All(ctx, &rooms); err != nil {
		return serverError(c)
	}

	// One membership query for the whole page instead of one per room.
	roomIDs := make([]primitive.ObjectID, 0, len(rooms))
	for _, room := range rooms {
		roomIDs = append(roomIDs, room.ID)
	}
	memberships, err := loadMemberships(ctx, roomIDs, user.ID)
	if err != nil {
		return serverError(c)
	}

	items := make([]fiber.Map, 0, len(rooms))
	for _, room := range rooms {
		rc := roomContext{Room: room}
		if member, ok := memberships[room.ID]; ok {
			copied := member
			rc.Member = &copied
			if member.Status == models.RoomMemberActive {
				rc.Role = member.Role
			}
		}
		items = append(items, roomResponse(room, &rc, user))
	}
	nextCursor := ""
	if cursorPaginated && int64(len(rooms)) == limit && len(rooms) > 0 {
		nextCursor = rooms[len(rooms)-1].ID.Hex()
	}
	return c.JSON(fiber.Map{"rooms": items, "nextCursor": nextCursor})
}

// regexQuoteMeta escapes every regex metacharacter so a search string is treated
// as a literal prefix.
func regexQuoteMeta(value string) string {
	var builder strings.Builder
	builder.Grow(len(value) * 2)
	for _, r := range value {
		if strings.ContainsRune(`\.+*?()|[]{}^$`, r) {
			builder.WriteByte('\\')
		}
		builder.WriteRune(r)
	}
	return builder.String()
}

func loadMemberships(ctx context.Context, roomIDs []primitive.ObjectID, userID primitive.ObjectID) (map[primitive.ObjectID]models.RoomMember, error) {
	memberships := make(map[primitive.ObjectID]models.RoomMember, len(roomIDs))
	if len(roomIDs) == 0 {
		return memberships, nil
	}
	cursor, err := config.DB.Collection(roomMembersCollection).
		Find(ctx, bson.M{"roomId": bson.M{"$in": roomIDs}, "userId": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var members []models.RoomMember
	if err := cursor.All(ctx, &members); err != nil {
		return nil, err
	}
	for _, member := range members {
		memberships[member.RoomID] = member
	}
	return memberships, nil
}

// GetMyRooms lists the caller's rooms, including private ones they belong to.
func GetMyRooms(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	cursor, err := config.DB.Collection(roomMembersCollection).Find(ctx,
		bson.M{"userId": user.ID, "status": models.RoomMemberActive},
		options.Find().SetSort(bson.D{{Key: "lastSeenAt", Value: -1}}).SetLimit(100))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var members []models.RoomMember
	if err := cursor.All(ctx, &members); err != nil {
		return serverError(c)
	}
	if len(members) == 0 {
		return c.JSON(fiber.Map{"rooms": []fiber.Map{}})
	}

	roomIDs := make([]primitive.ObjectID, 0, len(members))
	membersByRoom := make(map[primitive.ObjectID]models.RoomMember, len(members))
	for _, member := range members {
		roomIDs = append(roomIDs, member.RoomID)
		membersByRoom[member.RoomID] = member
	}
	roomCursor, err := config.DB.Collection(roomsCollectionName).
		Find(ctx, bson.M{"_id": bson.M{"$in": roomIDs}, "archived": false})
	if err != nil {
		return serverError(c)
	}
	defer roomCursor.Close(ctx)
	var rooms []models.StudyRoom
	if err := roomCursor.All(ctx, &rooms); err != nil {
		return serverError(c)
	}

	items := make([]fiber.Map, 0, len(rooms))
	for _, room := range rooms {
		member := membersByRoom[room.ID]
		rc := roomContext{Room: room, Member: &member, Role: member.Role}
		payload := roomResponse(room, &rc, user)
		payload["myStudyMinutes"] = member.StudyMinutes
		payload["myXp"] = member.XP
		items = append(items, payload)
	}
	return c.JSON(fiber.Map{"rooms": items})
}

// GetRoom returns one room. Non-members may read public/goal/elite rooms so they
// can decide whether to join; private rooms 404.
func GetRoom(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	roomID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return badRequest(c, "Invalid room ID")
	}
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	rc, err := loadRoomContext(ctx, roomID, user.ID)
	switch {
	case errors.Is(err, mongo.ErrNoDocuments), errors.Is(err, errRoomNotVisible):
		return roomNotFound(c)
	case err != nil:
		return serverError(c)
	}
	if rc.isBanned() {
		return roomForbidden(c, "You have been removed from this room")
	}

	response := roomResponse(rc.Room, &rc, user)
	owner, err := loadUserSummaries(ctx, []primitive.ObjectID{rc.Room.OwnerID})
	if err == nil {
		if summary, ok := owner[rc.Room.OwnerID]; ok {
			response["owner"] = summary
		}
	}
	if models.CanAdministerRoom(rc.Role) && rc.Room.InviteCode != "" {
		response["inviteCode"] = rc.Room.InviteCode
	}
	return c.JSON(response)
}

// UpdateRoom edits room metadata. Moderators may edit presentation; only the
// owner may change visibility, entry requirements, or the goal.
func UpdateRoom(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	if !models.CanModerate(rc.Role) {
		return roomForbidden(c, "Only moderators can edit this room")
	}

	var input models.RoomInput
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Invalid request")
	}
	// Unspecified fields keep their stored value, and non-owners cannot move the
	// governance fields at all.
	if input.Visibility == "" {
		input.Visibility = rc.Room.Visibility
	}
	if input.Category == "" {
		input.Category = rc.Room.Category
	}
	if input.Goal == nil {
		input.Goal = rc.Room.Goal
	}
	if input.Requirements == nil {
		input.Requirements = rc.Room.Requirements
	}
	if !models.CanAdministerRoom(rc.Role) {
		if input.Visibility != rc.Room.Visibility {
			return roomForbidden(c, "Only the owner can change visibility")
		}
		input.Requirements = rc.Room.Requirements
		input.Goal = rc.Room.Goal
	}

	now := time.Now().UTC()
	clean, err := models.ValidateRoomInput(input, now)
	if err != nil {
		// A stored goal whose target date has passed must not block unrelated
		// edits, so re-validate against the original creation date in that case.
		if errors.Is(err, models.ErrRoomGoalDate) && rc.Room.Goal != nil && input.Goal == rc.Room.Goal {
			clean, err = models.ValidateRoomInput(input, rc.Room.CreatedAt)
		}
		if err != nil {
			return badRequest(c, err.Error())
		}
	}

	update := bson.M{
		"name": clean.Name, "description": clean.Description, "category": clean.Category,
		"tags": clean.Tags, "rules": clean.Rules, "coverImageUrl": clean.CoverImageURL,
		"visibility": clean.Visibility, "updatedAt": now,
	}
	// Becoming private requires an invite code: without one CanJoinRoom refuses
	// every join (it compares against an empty stored code), which would leave the
	// room permanently unjoinable and invisible in discovery.
	if clean.Visibility == models.RoomVisibilityPrivate && rc.Room.InviteCode == "" {
		code, codeErr := generateInviteCode()
		if codeErr != nil {
			return serverError(c)
		}
		update["inviteCode"] = code
	}
	if clean.Goal != nil {
		update["goal"] = clean.Goal
	}
	if clean.Requirements != nil {
		update["requirements"] = clean.Requirements
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	var updated models.StudyRoom
	err = config.DB.Collection(roomsCollectionName).FindOneAndUpdate(ctx,
		bson.M{"_id": rc.Room.ID},
		bson.M{"$set": update},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updated)
	if err != nil {
		return serverError(c)
	}
	realtime.NotifyRoom(updated.ID.Hex(), "room:updated")
	rc.Room = updated
	return c.JSON(roomResponse(updated, &rc, user))
}

// ArchiveRoom soft-deletes a room (owner only) so member history and stats
// survive and no hard delete can orphan messages or sessions.
func ArchiveRoom(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	if !models.CanAdministerRoom(rc.Role) {
		return roomForbidden(c, "Only the owner can archive this room")
	}
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	_, err := config.DB.Collection(roomsCollectionName).UpdateOne(ctx,
		bson.M{"_id": rc.Room.ID},
		bson.M{"$set": bson.M{"archived": true, "updatedAt": time.Now().UTC()}})
	if err != nil {
		return serverError(c)
	}
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:archived")
	return c.JSON(fiber.Map{"archived": true})
}

// JoinRoom enforces every join rule through models.CanJoinRoom. A previously
// banned member cannot rejoin, and the member counter is only incremented when a
// membership document is actually created.
func JoinRoom(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	roomID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return badRequest(c, "Invalid room ID")
	}
	var body struct {
		InviteCode string `json:"inviteCode"`
	}
	_ = c.BodyParser(&body)

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var room models.StudyRoom
	if err := config.DB.Collection(roomsCollectionName).FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}

	var existing models.RoomMember
	err = config.DB.Collection(roomMembersCollection).
		FindOne(ctx, bson.M{"roomId": roomID, "userId": user.ID}).Decode(&existing)
	if err == nil {
		switch existing.Status {
		case models.RoomMemberBanned:
			return roomForbidden(c, "You have been removed from this room")
		case models.RoomMemberActive:
			return c.JSON(fiber.Map{"joined": true, "role": existing.Role})
		}
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return serverError(c)
	}

	if allowed, reason := models.CanJoinRoom(room, user, body.InviteCode); !allowed {
		if room.Visibility == models.RoomVisibilityPrivate {
			// Do not confirm that a private room exists on a bad invite.
			return roomNotFound(c)
		}
		return roomForbidden(c, reason)
	}

	now := time.Now().UTC()
	member := models.RoomMember{
		RoomID: roomID, UserID: user.ID, Role: models.RoomRoleMember,
		Status: models.RoomMemberActive, JoinedAt: now, LastSeenAt: now,
	}
	// Upsert keyed on the unique (roomId,userId) index: two concurrent joins
	// cannot create two memberships or double-count the member.
	result, err := config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": roomID, "userId": user.ID},
		bson.M{"$setOnInsert": member},
		options.Update().SetUpsert(true))
	if err != nil {
		return serverError(c)
	}
	if result.UpsertedCount == 1 {
		_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx,
			bson.M{"_id": roomID},
			bson.M{"$inc": bson.M{"memberCount": 1}, "$set": bson.M{"lastActivityAt": now}})
		realtime.NotifyRoom(roomID.Hex(), "room:members")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"joined": true, "role": models.RoomRoleMember})
}

// LeaveRoom removes a membership. An owner must transfer ownership first,
// otherwise the room would be left unadministrable. Leaving is deliberately
// allowed in an archived room: a member must always be able to exit.
func LeaveRoom(c *fiber.Ctx) error {
	rc, user, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	if rc.Role == models.RoomRoleOwner {
		return roomForbidden(c, "Transfer ownership before leaving this room")
	}
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	result, err := config.DB.Collection(roomMembersCollection).
		DeleteOne(ctx, bson.M{"roomId": rc.Room.ID, "userId": user.ID, "status": models.RoomMemberActive})
	if err != nil {
		return serverError(c)
	}
	if result.DeletedCount == 1 {
		_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx,
			bson.M{"_id": rc.Room.ID, "memberCount": bson.M{"$gt": 0}},
			bson.M{"$inc": bson.M{"memberCount": -1}})
		_, _ = config.DB.Collection(roomPresenceCollection).
			DeleteOne(ctx, bson.M{"roomId": rc.Room.ID, "userId": user.ID})
		realtime.NotifyRoom(rc.Room.ID.Hex(), "room:members")
	}
	return c.JSON(fiber.Map{"left": true})
}

// GetRoomMembers returns the paginated roster with one batched user lookup.
func GetRoomMembers(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	limit := parseRoomLimit(c.Query("limit"))
	filter := bson.M{"roomId": rc.Room.ID, "status": models.RoomMemberActive}
	if before := strings.TrimSpace(c.Query("before")); before != "" {
		cursorID, err := primitive.ObjectIDFromHex(before)
		if err != nil {
			return badRequest(c, "Invalid pagination cursor")
		}
		filter["_id"] = bson.M{"$lt": cursorID}
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	cursor, err := config.DB.Collection(roomMembersCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(limit))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var members []models.RoomMember
	if err := cursor.All(ctx, &members); err != nil {
		return serverError(c)
	}

	userIDs := make([]primitive.ObjectID, 0, len(members))
	for _, member := range members {
		userIDs = append(userIDs, member.UserID)
	}
	summaries, err := loadUserSummaries(ctx, userIDs)
	if err != nil {
		return serverError(c)
	}

	items := make([]fiber.Map, 0, len(members))
	for _, member := range members {
		items = append(items, fiber.Map{
			"id": member.ID.Hex(), "user": summaries[member.UserID], "role": member.Role,
			"studyMinutes": member.StudyMinutes, "sessionsCompleted": member.SessionsCompleted,
			"xp": member.XP, "level": models.LevelForXP(member.XP), "joinedAt": member.JoinedAt,
		})
	}
	nextCursor := ""
	if int64(len(members)) == limit && len(members) > 0 {
		nextCursor = members[len(members)-1].ID.Hex()
	}
	return c.JSON(fiber.Map{"members": items, "nextCursor": nextCursor})
}

// UpdateRoomMember promotes, demotes or bans a member. Role changes are owner
// only and cannot mint an owner; bans are available to moderators but never
// against an equal-or-higher role.
func UpdateRoomMember(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	targetID, err := primitive.ObjectIDFromHex(c.Params("userId"))
	if err != nil {
		return badRequest(c, "Invalid member ID")
	}
	var body struct {
		Role   string `json:"role"`
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	var target models.RoomMember
	err = config.DB.Collection(roomMembersCollection).
		FindOne(ctx, bson.M{"roomId": rc.Room.ID, "userId": targetID}).Decode(&target)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}

	update := bson.M{}
	if role := strings.TrimSpace(body.Role); role != "" {
		if !models.CanAssignRole(rc.Role, user.ID, targetID, role) {
			return roomForbidden(c, "You cannot assign that role")
		}
		if target.Role == models.RoomRoleOwner {
			return roomForbidden(c, "The owner's role cannot be changed")
		}
		update["role"] = role
	}
	if status := strings.TrimSpace(body.Status); status != "" {
		if status != models.RoomMemberBanned && status != models.RoomMemberActive {
			return badRequest(c, "Invalid member status")
		}
		if !models.CanModerate(rc.Role) || user.ID == targetID {
			return roomForbidden(c, "You cannot change that member's status")
		}
		if models.RoleRank(target.Role) >= models.RoleRank(rc.Role) {
			return roomForbidden(c, "You cannot moderate an equal or higher role")
		}
		update["status"] = status
	}
	if len(update) == 0 {
		return badRequest(c, "Nothing to update")
	}

	if _, err := config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": targetID}, bson.M{"$set": update}); err != nil {
		return serverError(c)
	}
	if update["status"] == models.RoomMemberBanned {
		_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx,
			bson.M{"_id": rc.Room.ID, "memberCount": bson.M{"$gt": 0}},
			bson.M{"$inc": bson.M{"memberCount": -1}})
		_, _ = config.DB.Collection(roomPresenceCollection).
			DeleteOne(ctx, bson.M{"roomId": rc.Room.ID, "userId": targetID})
	}
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:members")
	// Tell the affected member directly: their own room list changed.
	realtime.NotifyChange(targetID.Hex(), "rooms")
	return c.JSON(fiber.Map{"updated": true})
}

// TransferRoomOwnership hands the room to another active member and demotes the
// previous owner to moderator. LeaveRoom refuses to let an owner walk away, so
// without this endpoint an owner could never leave and a room could never change
// hands.
func TransferRoomOwnership(c *fiber.Ctx) error {
	rc, user, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	if !models.CanAdministerRoom(rc.Role) {
		return roomForbidden(c, "Only the owner can transfer ownership")
	}
	targetID, err := primitive.ObjectIDFromHex(c.Params("userId"))
	if err != nil {
		return badRequest(c, "Invalid member ID")
	}
	if targetID == user.ID {
		return badRequest(c, "You already own this room")
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var target models.RoomMember
	err = config.DB.Collection(roomMembersCollection).FindOne(ctx, bson.M{
		"roomId": rc.Room.ID, "userId": targetID, "status": models.RoomMemberActive,
	}).Decode(&target)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return badRequest(c, "That member is not in this room")
		}
		return serverError(c)
	}

	// Promote first: if the demotion failed afterwards the room would briefly
	// have two owners, which is recoverable. The reverse order could leave it
	// with none, which is not.
	if _, err := config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": targetID},
		bson.M{"$set": bson.M{"role": models.RoomRoleOwner}}); err != nil {
		return serverError(c)
	}
	if _, err := config.DB.Collection(roomsCollectionName).UpdateOne(ctx,
		bson.M{"_id": rc.Room.ID},
		bson.M{"$set": bson.M{"ownerId": targetID, "updatedAt": time.Now().UTC()}}); err != nil {
		return serverError(c)
	}
	if _, err := config.DB.Collection(roomMembersCollection).UpdateOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": user.ID},
		bson.M{"$set": bson.M{"role": models.RoomRoleModerator}}); err != nil {
		return serverError(c)
	}

	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:members")
	realtime.NotifyChange(targetID.Hex(), "rooms")
	return c.JSON(fiber.Map{"transferred": true, "ownerId": targetID.Hex()})
}

// RestoreRoom un-archives a room. Archiving is reversible on purpose: without
// this, one mis-click would permanently strand a room and all of its history.
func RestoreRoom(c *fiber.Ctx) error {
	rc, user, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	if !models.CanAdministerRoom(rc.Role) {
		return roomForbidden(c, "Only the owner can restore this room")
	}
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	var restored models.StudyRoom
	err := config.DB.Collection(roomsCollectionName).FindOneAndUpdate(ctx,
		bson.M{"_id": rc.Room.ID},
		bson.M{"$set": bson.M{"archived": false, "updatedAt": time.Now().UTC()}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&restored)
	if err != nil {
		return serverError(c)
	}
	realtime.NotifyRoom(restored.ID.Hex(), "room:updated")
	rc.Room = restored
	return c.JSON(roomResponse(restored, &rc, user))
}

// GetRoomChanges long-polls the room stream. Membership is verified here because
// realtime.ReadRoomChanges performs no authorization of its own.
func GetRoomChanges(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	cursor := c.Query("cursor")
	if !validRealtimeCursor(cursor) {
		return badRequest(c, "Invalid realtime cursor")
	}
	wait := realtimeWaitSeconds(c.Query("timeout"))
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(wait+2)*time.Second)
	defer cancel()
	changes, err := realtime.ReadRoomChanges(ctx, rc.Room.ID.Hex(), cursor, time.Duration(wait)*time.Second)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Realtime service unavailable"})
	}
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	return c.JSON(changes)
}
