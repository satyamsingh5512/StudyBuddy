package handlers

import (
	"context"
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetAdminStats(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	adminEmail := os.Getenv("NEXT_PUBLIC_ADMIN_EMAIL") // keeping the env var name for compatibility

	if user.Email != adminEmail {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	usersColl := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	today := time.Now()
	y, m, d := today.Date()
	startOfToday := time.Date(y, m, d, 0, 0, 0, 0, today.Location())

	// Use aggregation to get all counts in one query
	pipeline := bson.A{
		bson.M{"$facet": bson.M{
			"totalUsers":    []bson.M{{"$count": "count"}},
			"verifiedUsers": []bson.M{{"$match": bson.M{"emailVerified": true}}, {"$count": "count"}},
			"activeToday":   []bson.M{{"$match": bson.M{"lastActive": bson.M{"$gte": startOfToday}}}, {"$count": "count"}},
		}},
	}
	aggCursor, err := usersColl.Aggregate(ctx, pipeline)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Aggregation error"})
	}
	var aggResult []bson.M
	if err := aggCursor.All(ctx, &aggResult); err != nil || len(aggResult) == 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Aggregation result error"})
	}
	facet := aggResult[0]
	getCount := func(key string) int64 {
		arr, ok := facet[key].(primitive.A)
		if !ok || len(arr) == 0 {
			return 0
		}
		doc, ok := arr[0].(bson.M)
		if !ok {
			return 0
		}

		switch v := doc["count"].(type) {
		case int32:
			return int64(v)
		case int64:
			return v
		case float64:
			return int64(v)
		default:
			return 0
		}
	}

	totalUsers := getCount("totalUsers")
	verifiedUsers := getCount("verifiedUsers")
	activeToday := getCount("activeToday")

	// Only fetch emails for temp-domain check (projection keeps payload small).
	tempDomains := []string{"tempmail", "10minutemail", "guerrillamail"}
	emailCursor, err := usersColl.Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"email": 1}))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Email fetch error"})
	}
	defer emailCursor.Close(ctx)

	type EmailDoc struct {
		Email string `bson:"email"`
	}
	tempEmailUsers := 0
	for emailCursor.Next(ctx) {
		var doc EmailDoc
		if err := emailCursor.Decode(&doc); err == nil {
			parts := strings.Split(doc.Email, "@")
			if len(parts) == 2 {
				domain := parts[1]
				for _, td := range tempDomains {
					if strings.Contains(domain, td) {
						tempEmailUsers++
						break
					}
				}
			}
		}
	}
	if err := emailCursor.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Email cursor error"})
	}

	return c.JSON(fiber.Map{
		"totalUsers":     totalUsers,
		"verifiedUsers":  verifiedUsers,
		"activeToday":    activeToday,
		"tempEmailUsers": tempEmailUsers,
		"timestamp":      time.Now(),
	})
}

func SendDailyStats(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	adminEmail := os.Getenv("NEXT_PUBLIC_ADMIN_EMAIL")

	if user.Email != adminEmail {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"message":           "Daily stats emails processed (mocked)",
		"successCount":      0,
		"failCount":         0,
		"skippedTempEmails": 0,
		"totalUsers":        0,
	})
}
