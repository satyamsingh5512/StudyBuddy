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

type Achievement struct {
	ID       string `json:"id"`
	Category string `json:"category"`
	Title    string `json:"title"`
	Target   int    `json:"target"`
	Progress int    `json:"progress"`
	Earned   bool   `json:"earned"`
}

var streakAchievementThresholds = []int{3, 5, 7, 14, 30, 60, 100, 365}
var goalAchievementThresholds = []int{1, 3, 5, 10}

func deriveAchievements(bestStreak, completedGoals int) []Achievement {
	result := make([]Achievement, 0, len(streakAchievementThresholds)+len(goalAchievementThresholds))
	for _, target := range streakAchievementThresholds {
		result = append(result, Achievement{
			ID: fmt.Sprintf("streak-%d", target), Category: "streak",
			Title: fmt.Sprintf("%d day streak", target), Target: target,
			Progress: min(bestStreak, target), Earned: bestStreak >= target,
		})
	}
	for _, target := range goalAchievementThresholds {
		result = append(result, Achievement{
			ID: fmt.Sprintf("goals-%d", target), Category: "goals",
			Title: fmt.Sprintf("Complete %d goals", target), Target: target,
			Progress: min(completedGoals, target), Earned: completedGoals >= target,
		})
	}
	return result
}

func GetAchievements(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	completedGoals, err := config.DB.Collection(goalsCollection).CountDocuments(ctx, bson.M{
		"userId": user.ID, "status": models.GoalStatusCompleted, "deleteState": bson.M{"$exists": false},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch achievements"})
	}
	bestStreak := user.BestStreak
	if user.Streak > bestStreak {
		bestStreak = user.Streak
	}
	return c.JSON(fiber.Map{
		"bestStreak": bestStreak, "completedGoals": completedGoals,
		"achievements": deriveAchievements(bestStreak, int(completedGoals)),
	})
}
