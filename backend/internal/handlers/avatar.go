package handlers

import (
	"context"
	"fmt"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

func UploadAvatar(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	file, err := c.FormFile("avatar")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file provided"})
	}
	_ = file // Here we normally save it, but we mock it like Next.js backend

	secureUrl := fmt.Sprintf("https://api.dicebear.com/7.x/avataaars/svg?seed=%s_mock", user.ID.Hex())

	collection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": bson.M{"avatar": secureUrl, "avatarType": "upload", "updatedAt": time.Now()}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user avatar"})
	}

	return c.JSON(fiber.Map{"avatar": secureUrl})
}

func DeleteAvatar(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	collection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": user.ID},
		bson.M{
			"$set":   bson.M{"avatarType": "generated", "updatedAt": time.Now()},
			"$unset": bson.M{"avatar": ""},
		},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user avatar"})
	}

	return c.JSON(fiber.Map{"avatar": nil})
}
