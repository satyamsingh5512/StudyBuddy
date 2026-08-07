package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type WaitlistRequest struct {
	Email string `json:"email"`
}

// JoinWaitlist records an unauthenticated marketing sign-up.
//
// The route is public, so it is deliberately narrow: the address must parse as
// a real email before any database work happens, and the write is an idempotent
// upsert. Repeat or concurrent submissions of the same address therefore cannot
// grow the collection. The response is identical whether or not the address was
// already present, so the endpoint cannot be used to test list membership.
func JoinWaitlist(c *fiber.Ctx) error {
	var req WaitlistRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	email, err := security.NormalizeEmail(req.Email)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	collection := config.DB.Collection("waitlist")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$setOnInsert": bson.M{"email": email, "createdAt": time.Now()}},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}

	return c.JSON(fiber.Map{"success": true})
}
