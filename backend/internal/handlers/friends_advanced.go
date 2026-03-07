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

func GetFriendRequests(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	friendsColl := config.DB.Collection("friend_requests")
	usersColl := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := friendsColl.Find(ctx, bson.M{
		"receiverId": user.ID,
		"status":     "pending",
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}
	defer cursor.Close(ctx)

	var requests []models.FriendRequest
	if err = cursor.All(ctx, &requests); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}

	var response []fiber.Map
	for _, r := range requests {
		var requester models.User
		err := usersColl.FindOne(ctx, bson.M{"_id": r.SenderID}).Decode(&requester)
		if err != nil {
			continue
		}

		response = append(response, fiber.Map{
			"id": r.ID.Hex(),
			"sender": fiber.Map{
				"id":         requester.ID.Hex(),
				"name":       requester.Name,
				"username":   requester.Username,
				"avatar":     requester.Avatar,
				"avatarType": requester.AvatarType,
				"examGoal":   requester.ExamGoal,
				"totalPoints": requester.TotalPoints,
				"lastActive": requester.LastActive,
			},
			"createdAt": r.CreatedAt,
		})
	}

	if response == nil {
		response = []fiber.Map{}
	}

	return c.JSON(response)
}

func AcceptFriendRequest(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	reqIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(reqIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Update where the current user is the receiver and status is pending
	res, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "receiverId": user.ID, "status": "pending"},
		bson.M{"$set": bson.M{"status": "accepted", "updatedAt": time.Now()}},
	)

	if err != nil || res.ModifiedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Friend request not found or not pending"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func RejectFriendRequest(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	reqIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(reqIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "receiverId": user.ID, "status": "pending"},
		bson.M{"$set": bson.M{"status": "rejected", "updatedAt": time.Now()}},
	)

	if err != nil || res.ModifiedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Friend request not found or not pending"})
	}

	return c.JSON(fiber.Map{"success": true})
}

func DeleteFriend(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	reqIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(reqIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Primary behavior: allow deleting by friendship request id
	res, err := collection.DeleteOne(
		ctx,
		bson.M{
			"_id": objID,
			"$or": []bson.M{
				{"senderId": user.ID},
				{"receiverId": user.ID},
			},
		},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}
	if res.DeletedCount > 0 {
		return c.JSON(fiber.Map{"success": true})
	}

	// Compatibility behavior: if UI sends friend's user id, remove accepted relationship by participants.
	res, err = collection.DeleteOne(
		ctx,
		bson.M{
			"status": "accepted",
			"$or": []bson.M{
				{"senderId": user.ID, "receiverId": objID},
				{"senderId": objID, "receiverId": user.ID},
			},
		},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}
	if res.DeletedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Friend relationship not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}

type BlockUserRequest struct {
	UserID string `json:"userId"`
}

func BlockUser(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req BlockUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.UserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	blockedObjID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	if user.ID == blockedObjID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot block yourself"})
	}

	blocksColl := config.DB.Collection("blocks")
	friendsColl := config.DB.Collection("friend_requests")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = blocksColl.UpdateOne(
		ctx,
		bson.M{"blockerId": user.ID, "blockedId": blockedObjID},
		bson.M{"$set": bson.M{"blockerId": user.ID, "blockedId": blockedObjID, "createdAt": time.Now()}},
		// Here we would normally use upsert option, but mgo update options require a struct. Let's do it manually.
	)
	if err != nil {
		// Just try to insert if update fails
		blocksColl.InsertOne(ctx, bson.M{"blockerId": user.ID, "blockedId": blockedObjID, "createdAt": time.Now()})
	} else {
		// Just to be safe, standard upsert isn't directly exposed easily without options pkg
		var existing bson.M
		err = blocksColl.FindOne(ctx, bson.M{"blockerId": user.ID, "blockedId": blockedObjID}).Decode(&existing)
		if err != nil {
			blocksColl.InsertOne(ctx, bson.M{"blockerId": user.ID, "blockedId": blockedObjID, "createdAt": time.Now()})
		}
	}

	friendsColl.DeleteMany(ctx, bson.M{
		"$or": []bson.M{
			{"senderId": user.ID, "receiverId": blockedObjID},
			{"senderId": blockedObjID, "receiverId": user.ID},
		},
	})

	return c.JSON(fiber.Map{"success": true, "message": "User blocked"})
}

func GetBlockedUsers(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	blocksColl := config.DB.Collection("blocks")
	usersColl := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := blocksColl.Find(ctx, bson.M{"blockerId": user.ID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}
	defer cursor.Close(ctx)

	var blocks []bson.M
	if err = cursor.All(ctx, &blocks); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}

	if blocks == nil {
		blocks = []bson.M{}
	}

	var response []fiber.Map
	for _, b := range blocks {
		blockedID := b["blockedId"].(primitive.ObjectID)

		var blockedUser models.User
		err := usersColl.FindOne(ctx, bson.M{"_id": blockedID}).Decode(&blockedUser)

		var userInfo interface{} = nil
		if err == nil {
			userInfo = fiber.Map{
				"id":       blockedUser.ID.Hex(),
				"name":     blockedUser.Name,
				"username": blockedUser.Username,
			}
		}

		response = append(response, fiber.Map{
			"id":        b["_id"].(primitive.ObjectID).Hex(),
			"blockedId": blockedID.Hex(),
			"blocked":   userInfo,
			"createdAt": b["createdAt"],
		})
	}

	if response == nil {
		response = []fiber.Map{}
	}

	return c.JSON(response)
}

func UnblockUser(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	blockedIDHex := c.Params("id")

	blockedObjID, err := primitive.ObjectIDFromHex(blockedIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	blocksColl := config.DB.Collection("blocks")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = blocksColl.DeleteOne(ctx, bson.M{"blockerId": user.ID, "blockedId": blockedObjID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal Server Error"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User unblocked"})
}
