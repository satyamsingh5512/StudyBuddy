package handlers

import (
	"context"
	"regexp"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

type CheckUsernameRequest struct {
	Username string `json:"username"`
}

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func CheckUsername(c *fiber.Ctx) error {
	var req CheckUsernameRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
		}
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))
	if username == "" {
		username = strings.ToLower(strings.TrimSpace(c.Params("username")))
	}

	if username == "" || len(username) < 3 {
		return c.JSON(fiber.Map{"available": false, "message": "Username too short"})
	}
	if len(username) > 20 {
		return c.JSON(fiber.Map{"available": false, "message": "Username must be less than 20 characters"})
	}
	if !usernamePattern.MatchString(username) {
		return c.JSON(fiber.Map{"available": false, "message": "Only letters, numbers, and underscores allowed"})
	}

	currentUser, hasUser := c.Locals("user").(models.User)
	if hasUser && username == currentUser.Username {
		return c.JSON(fiber.Map{"available": true})
	}

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing bson.M
	err := usersCollection.FindOne(ctx, bson.M{"username": username}).Decode(&existing)
	if err == nil {
		suggestions := []string{
			username + "01",
			username + "_study",
			username + "_prep",
		}
		return c.JSON(fiber.Map{
			"available":   false,
			"message":     "Username taken",
			"suggestions": suggestions,
		})
	}

	return c.JSON(fiber.Map{"available": true, "message": "Username available"})
}

type UpdateProfileRequest struct {
	Name         *string   `json:"name,omitempty"`
	ExamGoal     *string   `json:"examGoal,omitempty"`
	StudentClass *string   `json:"studentClass,omitempty"`
	Batch        *string   `json:"batch,omitempty"`
	Syllabus     *string   `json:"syllabus,omitempty"`
	Subjects     *[]string `json:"subjects,omitempty"`
}

func UpdateProfile(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	updateDoc := bson.M{}
	if req.Name != nil {
		updateDoc["name"] = *req.Name
	}
	if req.ExamGoal != nil {
		updateDoc["examGoal"] = *req.ExamGoal
	}
	if req.StudentClass != nil {
		updateDoc["studentClass"] = *req.StudentClass
	}
	if req.Batch != nil {
		updateDoc["batch"] = *req.Batch
	}
	if req.Syllabus != nil {
		updateDoc["syllabus"] = *req.Syllabus
	}
	if req.Subjects != nil {
		updateDoc["subjects"] = *req.Subjects
	}

	if len(updateDoc) == 0 {
		return c.JSON(user)
	}

	updateDoc["updatedAt"] = time.Now()

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := usersCollection.UpdateOne(
		ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": updateDoc},
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	var updatedUser models.User
	err = usersCollection.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&updatedUser)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(updatedUser)
}
