package middleware

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func RequireAuth(c *fiber.Ctx) error {
	tokenString := c.Cookies("connect.sid")
	if tokenString == "" {
		authHeader := c.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		}
	}

	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "supersecret_studybuddy_dev_key"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	sub, ok := claims["sub"].(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	objID, err := primitive.ObjectIDFromHex(sub)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "message": "Unauthorized"})
	}

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

	type indexSpec struct {
		keys bson.D
		opts *options.IndexOptions
	}

	collectionIndexes := map[string][]indexSpec{
		"users": {
			{bson.D{{Key: "email", Value: 1}}, options.Index().SetName("idx_users_email").SetUnique(true)},
			{bson.D{{Key: "username", Value: 1}}, options.Index().SetName("idx_users_username").SetUnique(true)},
			{bson.D{{Key: "lastActive", Value: -1}}, options.Index().SetName("idx_users_lastActive")},
			{bson.D{{Key: "totalPoints", Value: -1}}, options.Index().SetName("idx_users_totalPoints")},
		},
		"todos": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_todos_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "dueDate", Value: -1}}, options.Index().SetName("idx_todos_userId_dueDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}}, options.Index().SetName("idx_todos_userId_scheduledDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_completed")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_scheduled_completed")},
		},
		"timer_sessions": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_timer_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "startTime", Value: -1}}, options.Index().SetName("idx_timer_userId_startTime")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_timer_userId_createdAt")},
		},
		"daily_reports": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}}, options.Index().SetName("idx_reports_userId_date")},
		},
		"messages": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_messages_userId")},
			{bson.D{{Key: "toUserId", Value: 1}}, options.Index().SetName("idx_messages_toUserId")},
			{bson.D{{Key: "createdAt", Value: -1}}, options.Index().SetName("idx_messages_createdAt")},
		},
		"notes": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_notes_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "pinned", Value: -1}}, options.Index().SetName("idx_notes_userId_pinned")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_notes_userId_createdAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "color", Value: 1}}, options.Index().SetName("idx_notes_userId_color")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "tags", Value: 1}}, options.Index().SetName("idx_notes_userId_tags")},
		},
	}

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