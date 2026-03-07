package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GetSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch schedules"})
	}
	defer cursor.Close(ctx)

	var schedules []models.ScheduleEvent
	if err = cursor.All(ctx, &schedules); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse schedules"})
	}

	if schedules == nil {
		schedules = []models.ScheduleEvent{}
	}
	return c.JSON(schedules)
}

type CreateScheduleRequest struct {
	Title     string `json:"title"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Type      string `json:"type"`
	Color     string `json:"color"`
}

func CreateSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateScheduleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	schedule := models.ScheduleEvent{
		UserID:    user.ID,
		Title:     req.Title,
		StartTime: startTime,
		EndTime:   endTime,
		Type:      req.Type,
		Color:     req.Color,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	collection := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, schedule)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create schedule"})
	}

	schedule.ID = res.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(schedule)
}

func DeleteSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	scheduleIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(scheduleIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.DeleteOne(ctx, bson.M{"_id": objID, "userId": user.ID})
	if err != nil || res.DeletedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Schedule not found or could not delete"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func UpdateSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	scheduleIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(scheduleIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req CreateScheduleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	updateDoc := bson.M{"updatedAt": time.Now()}
	if req.Title != "" {
		updateDoc["title"] = req.Title
	}
	if req.StartTime != "" {
		if parsed, parseErr := time.Parse(time.RFC3339, req.StartTime); parseErr == nil {
			updateDoc["startTime"] = parsed
		}
	}
	if req.EndTime != "" {
		if parsed, parseErr := time.Parse(time.RFC3339, req.EndTime); parseErr == nil {
			updateDoc["endTime"] = parsed
		}
	}
	if req.Type != "" {
		updateDoc["type"] = req.Type
	}
	if req.Color != "" {
		updateDoc["color"] = req.Color
	}

	collection := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "userId": user.ID},
		bson.M{"$set": updateDoc},
	)
	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Schedule not found"})
	}

	var updated models.ScheduleEvent
	if err := collection.FindOne(ctx, bson.M{"_id": objID, "userId": user.ID}).Decode(&updated); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch updated schedule"})
	}

	return c.JSON(updated)
}
