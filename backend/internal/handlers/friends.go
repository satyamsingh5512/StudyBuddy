package handlers

import (
	"context"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
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
	friendsCollection := config.DB.Collection("friend_requests")
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find all accepted requests
	cursor, err := friendsCollection.Find(ctx, bson.M{
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

	if len(requests) == 0 {
		return c.JSON([]fiber.Map{})
	}

	otherIDs := make([]primitive.ObjectID, 0, len(requests))
	friendshipByUserID := make(map[primitive.ObjectID]primitive.ObjectID, len(requests))
	for _, req := range requests {
		if req.SenderID == user.ID {
			otherIDs = append(otherIDs, req.ReceiverID)
			friendshipByUserID[req.ReceiverID] = req.ID
		} else {
			otherIDs = append(otherIDs, req.SenderID)
			friendshipByUserID[req.SenderID] = req.ID
		}
	}

	userCursor, err := usersCollection.Find(ctx, bson.M{"_id": bson.M{"$in": otherIDs}})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch friend details"})
	}
	defer userCursor.Close(ctx)

	var users []models.User
	if err = userCursor.All(ctx, &users); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse friend details"})
	}

	response := make([]fiber.Map, 0, len(users))
	for _, u := range users {
		friendshipID := friendshipByUserID[u.ID]
		response = append(response, fiber.Map{
			"id":         u.ID.Hex(),
			"friendshipId": friendshipID.Hex(),
			"username":   u.Username,
			"name":       u.Name,
			"avatar":     u.Avatar,
			"avatarType": u.AvatarType,
			"examGoal":   u.ExamGoal,
			"totalPoints": u.TotalPoints,
			"lastActive": u.LastActive,
		})
	}

	return c.JSON(response)
}

func SearchUsers(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	query := strings.TrimSpace(c.Query("query"))
	if len(query) < 2 {
		return c.JSON([]fiber.Map{})
	}

	usersCollection := config.DB.Collection("users")
	friendsCollection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"_id": bson.M{"$ne": user.ID},
		"$or": []bson.M{
			{"username": bson.M{"$regex": query, "$options": "i"}},
			{"name": bson.M{"$regex": query, "$options": "i"}},
		},
	}

	opts := options.Find().SetLimit(20).SetSort(bson.D{{Key: "totalPoints", Value: -1}})
	cursor, err := usersCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to search users"})
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err = cursor.All(ctx, &users); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse users"})
	}

	response := make([]fiber.Map, 0, len(users))
	for _, candidate := range users {
		friendshipStatus := interface{}(nil)
		isSender := false

		var req models.FriendRequest
		err := friendsCollection.FindOne(ctx, bson.M{
			"$or": []bson.M{
				{"senderId": user.ID, "receiverId": candidate.ID},
				{"senderId": candidate.ID, "receiverId": user.ID},
			},
		}).Decode(&req)

		if err == nil {
			friendshipStatus = req.Status
			isSender = req.SenderID == user.ID
		}

		response = append(response, fiber.Map{
			"id":             candidate.ID.Hex(),
			"username":       candidate.Username,
			"name":           candidate.Name,
			"avatar":         candidate.Avatar,
			"avatarType":     candidate.AvatarType,
			"examGoal":       candidate.ExamGoal,
			"totalPoints":    candidate.TotalPoints,
			"friendshipStatus": friendshipStatus,
			"isSender":       isSender,
			"lastActive":     candidate.LastActive,
		})
	}

	return c.JSON(response)
}
