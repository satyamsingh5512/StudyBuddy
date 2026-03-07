package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetLeaderboard(c *fiber.Ctx) error {
	collection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "totalPoints", Value: -1}}).SetLimit(50)
	cursor, err := collection.Find(ctx, bson.M{"showProfile": true}, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch leaderboard"})
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err = cursor.All(ctx, &users); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse users"})
	}

	// Filter out sensitive data manually
	type LeaderboardUser struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Username    string `json:"username"`
		TotalPoints int    `json:"totalPoints"`
		Streak      int    `json:"streak"`
	}

	var leaderboard []LeaderboardUser
	for _, u := range users {
		leaderboard = append(leaderboard, LeaderboardUser{
			ID:          u.ID.Hex(),
			Name:        u.Name,
			Username:    u.Username,
			TotalPoints: u.TotalPoints,
			Streak:      u.Streak,
		})
	}

	if leaderboard == nil {
		leaderboard = []LeaderboardUser{}
	}

	return c.JSON(leaderboard)
}

func CompleteOnboarding(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := collection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{"onboardingDone": true, "updatedAt": time.Now()}})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.JSON(fiber.Map{"message": "Onboarding completed"})
}
