package handlers

import (
	"context"
	"strings"
	"time"

	"studybuddy-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

type WaitlistRequest struct {
	Email string `json:"email"`
}

func JoinWaitlist(c *fiber.Ctx) error {
	var req WaitlistRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email is required"})
	}

	email := strings.ToLower(req.Email)

	collection := config.DB.Collection("waitlist")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing bson.M
	err := collection.FindOne(ctx, bson.M{"email": email}).Decode(&existing)
	if err == nil {
		// Already exists
		return c.JSON(fiber.Map{"success": true, "message": "Already on waitlist"})
	}

	_, err = collection.InsertOne(ctx, bson.M{
		"email":     email,
		"createdAt": time.Now(),
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}

	return c.JSON(fiber.Map{"success": true})
}
