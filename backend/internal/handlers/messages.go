package handlers

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	maxMessageLength    = 2000
	defaultMessageLimit = 50
	maxMessageLimit     = 100
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
		return badRequest(c, "Invalid request")
	}

	receiverID, err := primitive.ObjectIDFromHex(req.ReceiverID)
	if err != nil || receiverID == user.ID {
		return badRequest(c, "Invalid receiver")
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		content = strings.TrimSpace(req.Message)
	}
	if len([]rune(content)) > maxMessageLength {
		return badRequest(c, "Messages cannot exceed 2000 characters")
	}
	if req.FileURL != nil {
		trimmed := strings.TrimSpace(*req.FileURL)
		parsed, parseErr := url.ParseRequestURI(trimmed)
		if parseErr != nil || len(trimmed) > 2048 || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return badRequest(c, "Invalid file URL")
		}
		req.FileURL = &trimmed
	}
	if content == "" && req.FileURL == nil {
		return badRequest(c, "Message content is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if allowed, err := canMessage(ctx, user.ID, receiverID); err != nil {
		return serverError(c)
	} else if !allowed {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Messaging is only available between friends"})
	}

	now := time.Now().UTC()
	message := Message{
		SenderID: user.ID, ReceiverID: receiverID, Content: content, Message: content,
		FileURL: req.FileURL, Read: false, CreatedAt: now, UpdatedAt: now,
	}
	result, err := config.DB.Collection("direct_messages").InsertOne(ctx, message)
	if err != nil {
		return serverError(c)
	}
	message.ID = result.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(message)
}

func canMessage(ctx context.Context, senderID, receiverID primitive.ObjectID) (bool, error) {
	users := config.DB.Collection("users")
	count, err := users.CountDocuments(ctx, bson.M{"_id": receiverID})
	if err != nil || count == 0 {
		return false, err
	}
	blocks := config.DB.Collection("blocks")
	count, err = blocks.CountDocuments(ctx, bson.M{"$or": []bson.M{
		{"blockerId": senderID, "blockedId": receiverID},
		{"blockerId": receiverID, "blockedId": senderID},
	}})
	if err != nil || count > 0 {
		return false, err
	}
	friends := config.DB.Collection("friend_requests")
	count, err = friends.CountDocuments(ctx, bson.M{"status": "accepted", "$or": []bson.M{
		{"senderId": senderID, "receiverId": receiverID},
		{"senderId": receiverID, "receiverId": senderID},
	}})
	return count > 0, err
}

func GetConversations(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	friends := config.DB.Collection("friend_requests")
	cursor, err := friends.Find(ctx, bson.M{"status": "accepted", "$or": []bson.M{
		{"senderId": user.ID}, {"receiverId": user.ID},
	}}, options.Find().SetLimit(200))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var links []models.FriendRequest
	if err = cursor.All(ctx, &links); err != nil {
		return serverError(c)
	}

	otherIDs := make([]primitive.ObjectID, 0, len(links))
	for _, link := range links {
		otherID := link.SenderID
		if otherID == user.ID {
			otherID = link.ReceiverID
		}
		otherIDs = append(otherIDs, otherID)
	}
	if len(otherIDs) == 0 {
		return c.JSON([]fiber.Map{})
	}

	userCursor, err := config.DB.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": otherIDs}})
	if err != nil {
		return serverError(c)
	}
	defer userCursor.Close(ctx)
	var friendUsers []models.User
	if err = userCursor.All(ctx, &friendUsers); err != nil {
		return serverError(c)
	}
	usersByID := make(map[primitive.ObjectID]models.User, len(friendUsers))
	for _, friend := range friendUsers {
		usersByID[friend.ID] = friend
	}

	type conversationSummary struct {
		OtherID     primitive.ObjectID `bson:"_id"`
		LastMessage Message            `bson:"lastMessage"`
		UnreadCount int64              `bson:"unreadCount"`
	}
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{"$or": bson.A{
			bson.M{"senderId": user.ID, "receiverId": bson.M{"$in": otherIDs}},
			bson.M{"receiverId": user.ID, "senderId": bson.M{"$in": otherIDs}},
		}}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "createdAt", Value: -1}}}},
		bson.D{{Key: "$addFields", Value: bson.M{"otherId": bson.M{"$cond": bson.A{
			bson.M{"$eq": bson.A{"$senderId", user.ID}}, "$receiverId", "$senderId",
		}}}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":         "$otherId",
			"lastMessage": bson.M{"$first": "$$ROOT"},
			"unreadCount": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$and": bson.A{
					bson.M{"$eq": bson.A{"$receiverId", user.ID}},
					bson.M{"$eq": bson.A{"$read", false}},
				}}, 1, 0,
			}}},
		}}},
	}
	summaryCursor, err := config.DB.Collection("direct_messages").Aggregate(ctx, pipeline)
	if err != nil {
		return serverError(c)
	}
	defer summaryCursor.Close(ctx)
	var summaries []conversationSummary
	if err = summaryCursor.All(ctx, &summaries); err != nil {
		return serverError(c)
	}
	summariesByID := make(map[primitive.ObjectID]conversationSummary, len(summaries))
	for _, summary := range summaries {
		summariesByID[summary.OtherID] = summary
	}

	response := make([]fiber.Map, 0, len(otherIDs))
	for _, otherID := range otherIDs {
		friend, ok := usersByID[otherID]
		if !ok {
			continue
		}
		summary, hasMessages := summariesByID[otherID]
		var lastMessage interface{}
		if hasMessages {
			lastMessage = summary.LastMessage
		}
		response = append(response, fiber.Map{
			"user":        fiber.Map{"id": friend.ID.Hex(), "username": friend.Username, "name": friend.Name, "avatar": friend.Avatar, "avatarType": friend.AvatarType, "lastActive": friend.LastActive},
			"lastMessage": lastMessage, "unreadCount": summary.UnreadCount,
		})
	}
	return c.JSON(response)
}

func GetMessages(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	otherID, err := primitive.ObjectIDFromHex(c.Params("userId"))
	if err != nil {
		return badRequest(c, "Invalid user ID")
	}

	limit := defaultMessageLimit
	if parsed, err := strconv.Atoi(c.Query("limit")); err == nil && parsed > 0 {
		if parsed > maxMessageLimit {
			parsed = maxMessageLimit
		}
		limit = parsed
	}
	filter := bson.M{"$or": []bson.M{
		{"senderId": user.ID, "receiverId": otherID},
		{"senderId": otherID, "receiverId": user.ID},
	}}
	if before := c.Query("before"); before != "" {
		cursorID, err := primitive.ObjectIDFromHex(before)
		if err != nil {
			return badRequest(c, "Invalid pagination cursor")
		}
		filter["_id"] = bson.M{"$lt": cursorID}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	collection := config.DB.Collection("direct_messages")
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var messages []Message
	if err = cursor.All(ctx, &messages); err != nil {
		return serverError(c)
	}
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
	if messages == nil {
		messages = []Message{}
	}
	_, _ = collection.UpdateMany(ctx, bson.M{"senderId": otherID, "receiverId": user.ID, "read": false}, bson.M{"$set": bson.M{"read": true}})
	return c.JSON(messages)
}
