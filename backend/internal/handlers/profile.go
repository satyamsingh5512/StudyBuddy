package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

type CheckUsernameRequest struct {
	Username string `json:"username"`
}

func CheckUsername(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CheckUsernameRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Username == "" || len(req.Username) < 3 {
		return c.JSON(fiber.Map{"available": false, "message": "Username too short"})
	}

	if req.Username == user.Username {
		return c.JSON(fiber.Map{"available": true})
	}

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing bson.M
	err := usersCollection.FindOne(ctx, bson.M{"username": req.Username}).Decode(&existing)
	if err == nil {
		return c.JSON(fiber.Map{"available": false, "message": "Username taken"})
	}

	return c.JSON(fiber.Map{"available": true})
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
