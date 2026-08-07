package middleware

import (
	"context"
	"log"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func RequireAuth(c *fiber.Ctx) error {
	tokenString := c.Cookies("connect.sid")

	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	claims, err := session.Parse(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	objID, err := primitive.ObjectIDFromHex(claims.Subject)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil || user.SessionVersion != claims.SessionVersion {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	models.NormalizeUserPreferences(&user)
	c.Locals("user", user)
	return c.Next()
}

// SetupIndexes creates MongoDB indexes for query optimization.
// Run this once during application startup. It is idempotent — MongoDB's
// createIndex is a no-op when an identical index already exists, and index
// names below are stable so re-running this on every boot is safe.
func SetupIndexes() {
	if config.DB == nil {
		log.Println("MongoDB not connected, skipping index setup")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collectionIndexes := indexSpecifications()

	for collectionName, specs := range collectionIndexes {
		coll := config.DB.Collection(collectionName)

		indexModels := make([]mongo.IndexModel, 0, len(specs))
		for _, spec := range specs {
			indexModels = append(indexModels, mongo.IndexModel{Keys: spec.keys, Options: spec.opts})
		}

		names, err := coll.Indexes().CreateMany(ctx, indexModels)
		if err != nil {
			log.Printf("Error creating indexes for %s: %v", collectionName, err)
			continue
		}
		for _, name := range names {
			log.Printf("✓ Ensured index: %s.%s", collectionName, name)
		}
	}

	log.Println("✅ MongoDB index setup complete")
}
