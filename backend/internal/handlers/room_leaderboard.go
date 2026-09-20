package handlers

// Study Rooms: leaderboards.
//
// Cost strategy, in the order the architecture doc prescribes:
//   1. Daily/weekly boards aggregate room_session_participants over a bounded
//      time bucket and are cached under a SHARED key (never per-user), obeying
//      the rules documented in internal/cache/cache.go for the 20MB free Redis.
//   2. Room-vs-room rankings read denormalized counters on study_rooms, so the
//      global board is an indexed sort, not an aggregation.
//   3. Nothing here runs a $lookup per member or a per-request full scan.
// Cached payloads contain only public profile fields, which is what makes a
// shared cache key safe.

import (
	"context"
	"strings"
	"time"

	"studybuddy-backend/internal/cache"
	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	roomLeaderboardSize   = 25
	roomRankingsSize      = 25
	roomLeaderboardKeyPfx = "sb:v1:room:leaderboard:"
	roomRankingsKey       = "sb:v1:room:rankings"
)

type leaderboardRow struct {
	UserID            primitive.ObjectID `bson:"_id"`
	FocusMinutes      int                `bson:"focusMinutes"`
	SessionsCompleted int                `bson:"sessionsCompleted"`
	SessionsJoined    int                `bson:"sessionsJoined"`
	XP                int                `bson:"xp"`
	ActiveDays        int                `bson:"activeDays"`
}

// GetRoomLeaderboard returns the daily or weekly board for one room.
func GetRoomLeaderboard(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	period := strings.ToLower(strings.TrimSpace(c.Query("period")))
	if period != "weekly" {
		period = "daily"
	}
	now := time.Now().UTC()
	bucketStart := models.LeaderboardPeriodStart(period, now)
	cacheKey := roomLeaderboardKeyPfx + rc.Room.ID.Hex() + ":" + period + ":" +
		bucketStart.Format("20060102")

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var cached []fiber.Map
	if cache.GetJSON(ctx, cacheKey, &cached) && len(cached) > 0 {
		return c.JSON(fiber.Map{"period": period, "since": bucketStart, "entries": cached, "cached": true})
	}

	// Aggregate the bucket: group per user, then sort in Mongo so only the top
	// rows cross the wire.
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{
			"roomId":      rc.Room.ID,
			"completedAt": bson.M{"$gte": bucketStart},
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":            "$userId",
			"focusMinutes":   bson.M{"$sum": "$actualMinutes"},
			"xp":             bson.M{"$sum": "$xpAwarded"},
			"sessionsJoined": bson.M{"$sum": 1},
			"sessionsCompleted": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$eq": bson.A{"$outcome", models.SessionOutcomeCompleted}}, 1, 0,
			}}},
			"activeDays": bson.M{"$addToSet": bson.M{"$dateToString": bson.M{
				"format": "%Y-%m-%d", "date": "$completedAt",
			}}},
		}}},
		bson.D{{Key: "$addFields", Value: bson.M{"activeDays": bson.M{"$size": "$activeDays"}}}},
		bson.D{{Key: "$sort", Value: bson.D{
			{Key: "focusMinutes", Value: -1}, {Key: "sessionsCompleted", Value: -1}, {Key: "_id", Value: 1},
		}}},
		bson.D{{Key: "$limit", Value: roomLeaderboardSize}},
	}
	cursor, err := config.DB.Collection(roomParticipantsCollection).Aggregate(ctx, pipeline)
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var rows []leaderboardRow
	if err := cursor.All(ctx, &rows); err != nil {
		return serverError(c)
	}

	userIDs := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		userIDs = append(userIDs, row.UserID)
	}
	summaries, err := loadUserSummaries(ctx, userIDs)
	if err != nil {
		return serverError(c)
	}

	entries := make([]fiber.Map, 0, len(rows))
	for index, row := range rows {
		entry := fiber.Map{
			"rank": index + 1, "user": summaries[row.UserID],
			"focusMinutes": row.FocusMinutes, "sessionsCompleted": row.SessionsCompleted,
			"xp": row.XP, "level": models.LevelForXP(row.XP),
		}
		if period == "weekly" {
			// The weekly board ranks consistency, not raw hours.
			entry["productivityScore"] = models.ProductivityScore(
				row.FocusMinutes, row.SessionsCompleted, row.SessionsJoined, row.ActiveDays)
			entry["activeDays"] = row.ActiveDays
		}
		entries = append(entries, entry)
	}
	// Shared key, public fields only, short TTL: safe on a tiny Redis.
	cache.SetJSON(ctx, cacheKey, entries, cache.TTLLeaderboard)

	return c.JSON(fiber.Map{"period": period, "since": bucketStart, "entries": entries, "cached": false})
}

// GetRoomRankings ranks rooms against each other. It reads denormalized counters
// so this is an indexed sort rather than a cross-collection aggregation.
func GetRoomRankings(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var cached []fiber.Map
	if cache.GetJSON(ctx, roomRankingsKey, &cached) && len(cached) > 0 {
		return c.JSON(fiber.Map{"rooms": cached, "cached": true})
	}

	cursor, err := config.DB.Collection(roomsCollectionName).Find(ctx,
		bson.M{"archived": false, "visibility": bson.M{"$ne": models.RoomVisibilityPrivate}},
		options.Find().
			SetSort(bson.D{{Key: "totalStudyMinutes", Value: -1}, {Key: "memberCount", Value: -1}, {Key: "_id", Value: 1}}).
			SetLimit(roomRankingsSize).
			SetProjection(bson.M{
				"name": 1, "slug": 1, "category": 1, "visibility": 1, "memberCount": 1,
				"totalStudyMinutes": 1, "sessionsHosted": 1, "lastActivityAt": 1,
			}))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var rooms []models.StudyRoom
	if err := cursor.All(ctx, &rooms); err != nil {
		return serverError(c)
	}

	entries := make([]fiber.Map, 0, len(rooms))
	for index, room := range rooms {
		// Retention proxy: collective hours per member. A huge room with idle
		// members should not outrank a small, genuinely active one.
		perMember := 0
		if room.MemberCount > 0 {
			perMember = room.TotalStudyMinutes / room.MemberCount
		}
		entries = append(entries, fiber.Map{
			"rank": index + 1, "id": room.ID.Hex(), "name": room.Name, "slug": room.Slug,
			"category": room.Category, "visibility": room.Visibility,
			"memberCount": room.MemberCount, "totalStudyMinutes": room.TotalStudyMinutes,
			"minutesPerMember": perMember, "sessionsHosted": room.SessionsHosted,
			"lastActivityAt": room.LastActivityAt,
		})
	}
	cache.SetJSON(ctx, roomRankingsKey, entries, cache.TTLLeaderboard)
	return c.JSON(fiber.Map{"rooms": entries, "cached": false})
}

// GetRoomAchievements evaluates the caller's room achievements through the
// extensible rule registry in models. Adding an achievement is one slice entry;
// this handler never changes.
func GetRoomAchievements(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	cursor, err := config.DB.Collection(roomMembersCollection).Find(ctx,
		bson.M{"userId": user.ID, "status": models.RoomMemberActive})
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var memberships []models.RoomMember
	if err := cursor.All(ctx, &memberships); err != nil {
		return serverError(c)
	}

	metrics := models.RoomAchievementMetrics{Streak: user.Streak, RoomsJoined: len(memberships)}
	totalXP := 0
	for _, membership := range memberships {
		metrics.SessionsCompleted += membership.SessionsCompleted
		metrics.StudyMinutes += membership.StudyMinutes
		totalXP += membership.XP
	}

	earned := models.EvaluateRoomAchievements(metrics)
	earnedSet := make(map[string]struct{}, len(earned))
	for _, id := range earned {
		earnedSet[id] = struct{}{}
	}
	items := make([]fiber.Map, 0, len(models.RoomAchievementRules))
	for _, rule := range models.RoomAchievementRules {
		_, unlocked := earnedSet[rule.ID]
		items = append(items, fiber.Map{
			"id": rule.ID, "title": rule.Title, "description": rule.Description, "unlocked": unlocked,
		})
	}
	return c.JSON(fiber.Map{
		"achievements": items,
		"xp":           totalXP,
		"level":        models.LevelForXP(totalXP),
		"nextLevelXp":  models.XPForNextLevel(totalXP),
		"metrics": fiber.Map{
			"sessionsCompleted": metrics.SessionsCompleted,
			"studyMinutes":      metrics.StudyMinutes,
			"roomsJoined":       metrics.RoomsJoined,
			"streak":            metrics.Streak,
		},
	})
}
