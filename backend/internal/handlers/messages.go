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

type SendMessageRequest struct {
	ReceiverID string  `json:"receiverId"`
	Content    string  `json:"content"`
	FileURL    *string `json:"fileUrl,omitempty"`
}

type Message struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SenderID   primitive.ObjectID `bson:"senderId" json:"senderId"`
	ReceiverID primitive.ObjectID `bson:"receiverId" json:"receiverId"`
	Content    string             `bson:"content" json:"content"`
	Message    string             `bson:"message" json:"message"`
	FileURL    *string            `bson:"fileUrl,omitempty" json:"fileUrl,omitempty"`
	Read       bool               `bson:"read" json:"read"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt  time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func SendMessage(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req SendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ReceiverID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Receiver ID is required"})
	}

	receiverObjID, err := primitive.ObjectIDFromHex(req.ReceiverID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid receiver ID"})
	}

	now := time.Now()
	newMsg := Message{
		SenderID:   user.ID,
		ReceiverID: receiverObjID,
		Content:    req.Content,
		Message:    req.Content,
		FileURL:    req.FileURL,
		Read:       false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	collection := config.DB.Collection("direct_messages")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, newMsg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to send message"})
	}

	newMsg.ID = res.InsertedID.(primitive.ObjectID)

	return c.Status(fiber.StatusCreated).JSON(newMsg)
}

func GetMessages(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	otherUserIDHex := c.Params("userId")

	otherObjID, err := primitive.ObjectIDFromHex(otherUserIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	collection := config.DB.Collection("direct_messages")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": []bson.M{
			{"senderId": user.ID, "receiverId": otherObjID},
			{"senderId": otherObjID, "receiverId": user.ID},
		},
	}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch messages"})
	}
	defer cursor.Close(ctx)

	var messages []Message
	if err = cursor.All(ctx, &messages); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse messages"})
	}

	if messages == nil {
		messages = []Message{}
	}

	// Mark as read
	collection.UpdateMany(
		ctx,
		bson.M{"senderId": otherObjID, "receiverId": user.ID, "read": false},
		bson.M{"$set": bson.M{"read": true}},
	)

	return c.JSON(messages)
}
