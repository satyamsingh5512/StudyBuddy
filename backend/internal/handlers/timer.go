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
	"go.mongodb.org/mongo-driver/mongo/options"
)

type SaveSessionRequest struct {
	Duration  int    `json:"duration"`
	Subject   string `json:"subject"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
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

	session := models.Session{
		UserID:    user.ID,
		Duration:  durationMinutes,
		Subject:   req.Subject,
		StartTime: startTime,
		EndTime:   endTime,
		CreatedAt: time.Now(),
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

	// Update user total stats
	usersCollection := config.DB.Collection("users")
	usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$inc": bson.M{"totalStudyMinutes": durationMinutes, "totalPoints": pointsEarned},
		"$set": bson.M{"lastActive": time.Now()},
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     "Session saved",
		"pointsEarned": pointsEarned,
		"session":     session,
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
