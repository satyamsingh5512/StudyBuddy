package handlers

import (
	"context"
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

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	session := models.Session{
		UserID:    user.ID,
		Duration:  req.Duration,
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

	// Update user total stats
	usersCollection := config.DB.Collection("users")
	usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$inc": bson.M{"totalStudyMinutes": req.Duration / 60, "totalPoints": (req.Duration / 60) * 10},
		"$set": bson.M{"lastActive": time.Now()},
	})

	return c.Status(fiber.StatusCreated).JSON(session)
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
