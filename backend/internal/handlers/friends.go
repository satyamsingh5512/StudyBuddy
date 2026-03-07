package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SendFriendRequestPayload struct {
	ReceiverID string `json:"receiverId"`
}

func SendFriendRequest(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	
	var req SendFriendRequestPayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	receiverObjID, err := primitive.ObjectIDFromHex(req.ReceiverID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid receiver ID"})
	}

	if user.ID == receiverObjID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot send request to yourself"})
	}

	collection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if already exists
	var existing models.FriendRequest
	err = collection.FindOne(ctx, bson.M{
		"$or": []bson.M{
			{"senderId": user.ID, "receiverId": receiverObjID},
			{"senderId": receiverObjID, "receiverId": user.ID},
		},
	}).Decode(&existing)

	if err == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Request already exists or are already friends"})
	}

	newReq := models.FriendRequest{
		SenderID:   user.ID,
		ReceiverID: receiverObjID,
		Status:     "pending",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	res, err := collection.InsertOne(ctx, newReq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to send request"})
	}

	newReq.ID = res.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(newReq)
}

func GetFriends(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find all accepted requests
	cursor, err := collection.Find(ctx, bson.M{
		"status": "accepted",
		"$or": []bson.M{
			{"senderId": user.ID},
			{"receiverId": user.ID},
		},
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch friends"})
	}
	defer cursor.Close(ctx)

	var requests []models.FriendRequest
	if err = cursor.All(ctx, &requests); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse friends"})
	}

	// For simplicity, just returning the connections. A full implementation would fetch user details.
	if requests == nil {
		requests = []models.FriendRequest{}
	}

	return c.JSON(requests)
}
