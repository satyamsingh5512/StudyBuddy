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

	totalUsers, _ := usersColl.CountDocuments(ctx, bson.M{})
	verifiedUsers, _ := usersColl.CountDocuments(ctx, bson.M{"emailVerified": true})

	today := time.Now()
	y, m, d := today.Date()
	startOfToday := time.Date(y, m, d, 0, 0, 0, 0, today.Location())

	activeToday, _ := usersColl.CountDocuments(ctx, bson.M{"lastActive": bson.M{"$gte": startOfToday}})

	tempDomains := []string{"tempmail", "10minutemail", "guerrillamail"}
	cursor, _ := usersColl.Find(ctx, bson.M{})
	var users []models.User
	_ = cursor.All(ctx, &users)

	tempEmailUsers := 0
	for _, u := range users {
		parts := strings.Split(u.Email, "@")
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
