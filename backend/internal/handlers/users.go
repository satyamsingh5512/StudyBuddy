package handlers

import (
	"context"
	"log"
	"regexp"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type CompleteOnboardingRequest struct {
	Username    string   `json:"username"`
	AvatarType  string   `json:"avatarType,omitempty"`
	Avatar      string   `json:"avatar,omitempty"`
	ExamGoal    string   `json:"examGoal,omitempty"`
	StudentClass string  `json:"studentClass,omitempty"`
	Batch       string   `json:"batch,omitempty"`
	Syllabus    string   `json:"syllabus,omitempty"`
	Subjects    []string `json:"subjects,omitempty"`
}

var onboardingUsernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

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

	var req CompleteOnboardingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))
	if username == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username is required"})
	}
	if len(username) < 3 || len(username) > 20 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username must be between 3 and 20 characters"})
	}
	if !onboardingUsernamePattern.MatchString(username) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username can only contain letters, numbers, and underscores"})
	}

	var existing models.User
	err := collection.FindOne(ctx, bson.M{
		"username": username,
		"_id":      bson.M{"$ne": user.ID},
	}).Decode(&existing)
	if err == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username already taken"})
	}

	updateDoc := bson.M{
		"onboardingDone": true,
		"updatedAt":      time.Now(),
		"username":       username,
	}
	if req.ExamGoal != "" {
		updateDoc["examGoal"] = req.ExamGoal
	}
	if req.StudentClass != "" {
		updateDoc["studentClass"] = req.StudentClass
	}
	if req.Batch != "" {
		updateDoc["batch"] = req.Batch
	}
	if req.Syllabus != "" {
		updateDoc["syllabus"] = req.Syllabus
	}
	if len(req.Subjects) > 0 {
		updateDoc["subjects"] = req.Subjects
	}
	if req.AvatarType != "" {
		updateDoc["avatarType"] = req.AvatarType
	}
	if req.Avatar != "" {
		updateDoc["avatar"] = req.Avatar
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": updateDoc})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	var updatedUser models.User
	if err := collection.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&updatedUser); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch updated user"})
	}

	if err := services.SendOnboardingWelcomeEmail(user.Email, user.Name); err != nil {
		log.Printf("failed to send onboarding welcome email to %s: %v", user.Email, err)
	}

	return c.JSON(updatedUser)
}
