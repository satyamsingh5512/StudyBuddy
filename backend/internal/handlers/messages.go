package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type SendMessageRequest struct {
	ReceiverID string  `json:"receiverId"`
	Content    string  `json:"content"`
	Message    string  `json:"message"`
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
	if req.Content == "" {
		req.Content = req.Message
	}
	if req.Content == "" && req.FileURL == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Message content is required"})
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

func GetConversations(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	friendsColl := config.DB.Collection("friend_requests")
	usersColl := config.DB.Collection("users")
	messagesColl := config.DB.Collection("direct_messages")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := friendsColl.Find(ctx, bson.M{
		"status": "accepted",
		"$or": []bson.M{
			{"senderId": user.ID},
			{"receiverId": user.ID},
		},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch conversations"})
	}
	defer cursor.Close(ctx)

	var links []models.FriendRequest
	if err = cursor.All(ctx, &links); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse conversations"})
	}

	response := make([]fiber.Map, 0, len(links))
	for _, link := range links {
		otherID := link.SenderID
		if otherID == user.ID {
			otherID = link.ReceiverID
		}

		var otherUser models.User
		if err := usersColl.FindOne(ctx, bson.M{"_id": otherID}).Decode(&otherUser); err != nil {
			continue
		}

		filter := bson.M{
			"$or": []bson.M{
				{"senderId": user.ID, "receiverId": otherID},
				{"senderId": otherID, "receiverId": user.ID},
			},
		}

		var lastMessage *Message
		findOpts := options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		var msg Message
		if err := messagesColl.FindOne(ctx, filter, findOpts).Decode(&msg); err == nil {
			lastMessage = &msg
		}

		unreadCount, _ := messagesColl.CountDocuments(ctx, bson.M{
			"senderId":   otherID,
			"receiverId": user.ID,
			"read":       false,
		})

		response = append(response, fiber.Map{
			"user": fiber.Map{
				"id":         otherUser.ID.Hex(),
				"username":   otherUser.Username,
				"name":       otherUser.Name,
				"avatar":     otherUser.Avatar,
				"avatarType": otherUser.AvatarType,
				"lastActive": otherUser.LastActive,
			},
			"lastMessage": lastMessage,
			"unreadCount": unreadCount,
		})
	}

	return c.JSON(response)
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
