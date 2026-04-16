package handlers

import (
	"context"
	"math"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type SaveSessionRequest struct {
	Duration  int    `json:"duration"`
	Subject   string `json:"subject"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Timezone  string `json:"timezone"`
}

func localDayBounds(t time.Time, loc *time.Location) (time.Time, time.Time) {
	lt := t.In(loc)
	y, m, d := lt.Date()
	start := time.Date(y, m, d, 0, 0, 0, 0, loc)
	return start, start.AddDate(0, 0, 1)
}

func localDayGap(from, to time.Time, loc *time.Location) int {
	fromLocal := from.In(loc)
	toLocal := to.In(loc)
	fromStamp := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 12, 0, 0, 0, time.UTC)
	toStamp := time.Date(toLocal.Year(), toLocal.Month(), toLocal.Day(), 12, 0, 0, 0, time.UTC)
	return int(toStamp.Sub(fromStamp).Hours() / 24)
}

func SaveTimerSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req SaveSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	durationMinutes := req.Duration
	if durationMinutes < 0 {
		durationMinutes = 0
	}
	// Backward compatibility: older clients may send duration in seconds.
	if durationMinutes > 300 {
		durationMinutes = int(math.Round(float64(durationMinutes) / 60.0))
	}

	startTime := time.Now()
	if req.StartTime != "" {
		if parsed, err := time.Parse(time.RFC3339, req.StartTime); err == nil {
			startTime = parsed
		}
	}

	endTime := time.Now()
	if req.EndTime != "" {
		if parsed, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
			endTime = parsed
		}
	}

	if endTime.Before(startTime) {
		endTime = startTime.Add(time.Duration(durationMinutes) * time.Minute)
	}

	now := time.Now()
	location := time.UTC
	if req.Timezone != "" {
		if tz, err := time.LoadLocation(req.Timezone); err == nil {
			location = tz
		}
	}

	session := models.Session{
		UserID:    user.ID,
		Duration:  durationMinutes,
		Subject:   req.Subject,
		StartTime: startTime,
		EndTime:   endTime,
		CreatedAt: now,
	}

	collection := config.DB.Collection("timer_sessions")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, session)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save session"})
	}

	session.ID = res.InsertedID.(primitive.ObjectID)

	pointsEarned := durationMinutes
	streakAfterSave := user.Streak

	usersCollection := config.DB.Collection("users")
	updateSet := bson.M{"lastActive": now, "updatedAt": now}

	if durationMinutes > 0 {
		sessionDayStart, nextDayStart := localDayBounds(now, location)

		// Only the first non-zero saved session for the user's local day can change streak.
		todaySessionCount, countErr := collection.CountDocuments(ctx, bson.M{
			"userId":    user.ID,
			"duration":  bson.M{"$gt": 0},
			"createdAt": bson.M{"$gte": sessionDayStart, "$lt": nextDayStart},
		})

		if countErr == nil && todaySessionCount == 1 {
			nextStreak := 1

			var prevSession models.Session
			prevErr := collection.FindOne(
				ctx,
				bson.M{
					"userId":    user.ID,
					"duration":  bson.M{"$gt": 0},
					"createdAt": bson.M{"$lt": sessionDayStart},
				},
				options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}}),
			).Decode(&prevSession)

			if prevErr == nil {
				gapDays := localDayGap(prevSession.CreatedAt, now, location)

				if gapDays == 1 {
					baseStreak := user.Streak
					if baseStreak < 1 {
						baseStreak = 1
					}
					nextStreak = baseStreak + 1
				}
			}

			if prevErr == nil || prevErr == mongo.ErrNoDocuments {
				streakAfterSave = nextStreak
				updateSet["streak"] = nextStreak
			}
		}
	}

	usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$inc": bson.M{"totalStudyMinutes": durationMinutes, "totalPoints": pointsEarned},
		"$set": updateSet,
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":      "Session saved",
		"pointsEarned": pointsEarned,
		"streak":       streakAfterSave,
		"session":      session,
	})
}

func GetTimerAnalytics(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("timer_sessions")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID}, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch analytics"})
	}
	defer cursor.Close(ctx)

	var sessions []models.Session
	if err = cursor.All(ctx, &sessions); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse analytics"})
	}

	if sessions == nil {
		sessions = []models.Session{}
	}

	return c.JSON(sessions)
}
