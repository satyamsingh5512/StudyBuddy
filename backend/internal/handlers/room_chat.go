package handlers

// Study Rooms: chat.
//
// Scale/abuse notes:
//   - History is paginated by _id (monotonic ObjectId) descending, the same
//     cursor scheme handlers/messages.go uses for DMs. No skip/offset, so deep
//     pages cost the same as the first.
//   - Author lookups are batched for the whole page (one extra query, not N).
//   - Spam brakes are layered: a per-user route rate limit, a duplicate-message
//     window, a rune cap, and a mention cap. All of the rules are pure functions
//     in models/room.go so they are unit tested.
//   - Deletes are soft: moderation must leave an audit trail and must not
//     renumber or reflow other members' pagination cursors.

import (
	"context"
	"errors"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/realtime"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const maxRoomMessagePage = 50

// GetRoomMessages returns a page of history oldest-first for rendering, with a
// cursor for loading older messages.
func GetRoomMessages(c *fiber.Ctx) error {
	rc, _, ok := requireRoomMember(c)
	if !ok {
		return nil
	}
	limit := parseRoomLimit(c.Query("limit"))
	if limit > maxRoomMessagePage {
		limit = maxRoomMessagePage
	}
	filter := bson.M{"roomId": rc.Room.ID}
	if before := strings.TrimSpace(c.Query("before")); before != "" {
		cursorID, err := primitive.ObjectIDFromHex(before)
		if err != nil {
			return badRequest(c, "Invalid pagination cursor")
		}
		filter["_id"] = bson.M{"$lt": cursorID}
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	cursor, err := config.DB.Collection(roomMessagesCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(limit))
	if err != nil {
		return serverError(c)
	}
	defer cursor.Close(ctx)
	var messages []models.RoomMessage
	if err := cursor.All(ctx, &messages); err != nil {
		return serverError(c)
	}

	nextCursor := ""
	if int64(len(messages)) == limit && len(messages) > 0 {
		nextCursor = messages[len(messages)-1].ID.Hex()
	}
	// Reverse to chronological order for rendering.
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}

	authorIDs := make([]primitive.ObjectID, 0, len(messages))
	for _, message := range messages {
		authorIDs = append(authorIDs, message.UserID)
	}
	summaries, err := loadUserSummaries(ctx, authorIDs)
	if err != nil {
		return serverError(c)
	}

	items := make([]fiber.Map, 0, len(messages))
	for _, message := range messages {
		items = append(items, roomMessageResponse(message, summaries))
	}
	return c.JSON(fiber.Map{"messages": items, "nextCursor": nextCursor})
}

func roomMessageResponse(message models.RoomMessage, summaries map[primitive.ObjectID]userSummary) fiber.Map {
	// A deleted message keeps its slot (so cursors stay stable) but never ships
	// its body to a client again.
	body := message.Body
	if message.Deleted {
		body = ""
	}
	reactions := make([]fiber.Map, 0, len(message.Reactions))
	for emoji, userIDs := range message.Reactions {
		if len(userIDs) == 0 {
			continue
		}
		hexIDs := make([]string, 0, len(userIDs))
		for _, id := range userIDs {
			hexIDs = append(hexIDs, id.Hex())
		}
		reactions = append(reactions, fiber.Map{"emoji": emoji, "count": len(userIDs), "userIds": hexIDs})
	}
	mentions := make([]string, 0, len(message.Mentions))
	for _, id := range message.Mentions {
		mentions = append(mentions, id.Hex())
	}
	payload := fiber.Map{
		"id": message.ID.Hex(), "body": body, "deleted": message.Deleted,
		"pinned": message.Pinned, "mentions": mentions, "reactions": reactions,
		"createdAt": message.CreatedAt, "user": summaries[message.UserID],
		"userId": message.UserID.Hex(),
	}
	if message.ReplyToID != nil {
		payload["replyToId"] = message.ReplyToID.Hex()
	}
	return payload
}

// CreateRoomMessage posts to a room.
func CreateRoomMessage(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	var body struct {
		Body      string   `json:"body"`
		ReplyToID string   `json:"replyToId"`
		Mentions  []string `json:"mentions"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}
	clean, err := models.SanitizeMessageBody(body.Body)
	if err != nil {
		return badRequest(c, err.Error())
	}

	rawMentions := make([]primitive.ObjectID, 0, len(body.Mentions))
	for _, raw := range body.Mentions {
		id, parseErr := primitive.ObjectIDFromHex(raw)
		if parseErr != nil {
			return badRequest(c, "Invalid mention")
		}
		rawMentions = append(rawMentions, id)
	}
	mentions, err := models.NormalizeMentions(rawMentions, user.ID)
	if err != nil {
		return badRequest(c, err.Error())
	}

	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var replyTo *primitive.ObjectID
	if trimmed := strings.TrimSpace(body.ReplyToID); trimmed != "" {
		id, parseErr := primitive.ObjectIDFromHex(trimmed)
		if parseErr != nil {
			return badRequest(c, "Invalid reply target")
		}
		// The parent must be in this room, otherwise a reply could be used to
		// probe for message IDs in rooms the caller cannot read.
		count, countErr := config.DB.Collection(roomMessagesCollection).
			CountDocuments(ctx, bson.M{"_id": id, "roomId": rc.Room.ID})
		if countErr != nil {
			return serverError(c)
		}
		if count == 0 {
			return badRequest(c, "Reply target not found in this room")
		}
		replyTo = &id
	}

	// Mentions must be members: a mention of a non-member is meaningless and
	// would leak room membership by omission.
	if len(mentions) > 0 {
		valid, countErr := config.DB.Collection(roomMembersCollection).CountDocuments(ctx, bson.M{
			"roomId": rc.Room.ID, "userId": bson.M{"$in": mentions}, "status": models.RoomMemberActive,
		})
		if countErr != nil {
			return serverError(c)
		}
		if int(valid) != len(mentions) {
			return badRequest(c, "You can only mention members of this room")
		}
	}

	// Duplicate brake: the same text twice within 30s is dropped.
	var previous models.RoomMessage
	prevErr := config.DB.Collection(roomMessagesCollection).FindOne(ctx,
		bson.M{"roomId": rc.Room.ID, "userId": user.ID},
		options.FindOne().SetSort(bson.D{{Key: "_id", Value: -1}})).Decode(&previous)
	if prevErr == nil && models.IsDuplicateMessage(previous.Body, previous.CreatedAt, clean, now) {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error":   "That message was just sent",
			"message": "That message was just sent",
		})
	} else if prevErr != nil && !errors.Is(prevErr, mongo.ErrNoDocuments) {
		return serverError(c)
	}

	message := models.RoomMessage{
		ID: primitive.NewObjectID(), RoomID: rc.Room.ID, UserID: user.ID,
		Body: clean, ReplyToID: replyTo, Mentions: mentions,
		Reactions: map[string][]primitive.ObjectID{}, CreatedAt: now,
	}
	if _, err := config.DB.Collection(roomMessagesCollection).InsertOne(ctx, message); err != nil {
		return serverError(c)
	}
	_, _ = config.DB.Collection(roomsCollectionName).UpdateOne(ctx, bson.M{"_id": rc.Room.ID},
		bson.M{"$inc": bson.M{"messageCount": 1}, "$set": bson.M{"lastActivityAt": now}})

	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:chat")
	// Mentioned members get a personal nudge on their own stream so the mention
	// is visible even when they do not have the room open.
	for _, mention := range mentions {
		realtime.NotifyChange(mention.Hex(), "rooms")
	}

	summaries := map[primitive.ObjectID]userSummary{user.ID: summarizeUser(user)}
	return c.Status(fiber.StatusCreated).JSON(roomMessageResponse(message, summaries))
}

// ToggleRoomMessageReaction adds or removes the caller's reaction. Emoji come
// from an allowlist so a client cannot store unbounded keys in the document.
func ToggleRoomMessageReaction(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	messageID, err := primitive.ObjectIDFromHex(c.Params("messageId"))
	if err != nil {
		return badRequest(c, "Invalid message ID")
	}
	var body struct {
		Emoji string `json:"emoji"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}
	emoji := strings.TrimSpace(body.Emoji)
	if !models.IsValidReaction(emoji) {
		return badRequest(c, models.ErrReactionInvalid.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	var message models.RoomMessage
	err = config.DB.Collection(roomMessagesCollection).
		FindOne(ctx, bson.M{"_id": messageID, "roomId": rc.Room.ID}).Decode(&message)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}
	if message.Deleted {
		return badRequest(c, "This message was deleted")
	}

	reacted := false
	for _, id := range message.Reactions[emoji] {
		if id == user.ID {
			reacted = true
			break
		}
	}
	// $addToSet/$pull keep the toggle atomic: two devices tapping at once cannot
	// produce a duplicated reaction entry.
	field := "reactions." + emoji
	var update bson.M
	if reacted {
		update = bson.M{"$pull": bson.M{field: user.ID}}
	} else {
		update = bson.M{"$addToSet": bson.M{field: user.ID}}
	}
	if _, err := config.DB.Collection(roomMessagesCollection).
		UpdateOne(ctx, bson.M{"_id": messageID, "roomId": rc.Room.ID}, update); err != nil {
		return serverError(c)
	}
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:chat")
	return c.JSON(fiber.Map{"emoji": emoji, "reacted": !reacted})
}

// DeleteRoomMessage soft-deletes. Authors may remove their own message;
// moderators may remove anyone's.
func DeleteRoomMessage(c *fiber.Ctx) error {
	rc, user, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	messageID, err := primitive.ObjectIDFromHex(c.Params("messageId"))
	if err != nil {
		return badRequest(c, "Invalid message ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	var message models.RoomMessage
	err = config.DB.Collection(roomMessagesCollection).
		FindOne(ctx, bson.M{"_id": messageID, "roomId": rc.Room.ID}).Decode(&message)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return roomNotFound(c)
		}
		return serverError(c)
	}
	if !models.CanDeleteMessage(user.ID, message.UserID, rc.Role) {
		return roomForbidden(c, "You cannot delete this message")
	}
	if message.Deleted {
		return c.JSON(fiber.Map{"deleted": true})
	}

	if _, err := config.DB.Collection(roomMessagesCollection).UpdateOne(ctx,
		bson.M{"_id": messageID, "roomId": rc.Room.ID},
		bson.M{"$set": bson.M{
			"deleted": true, "deletedBy": user.ID, "body": "",
		}}); err != nil {
		return serverError(c)
	}
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:chat")
	return c.JSON(fiber.Map{"deleted": true})
}

// PinRoomMessage toggles the pin (moderators only) so a room can keep its
// current objective at the top.
func PinRoomMessage(c *fiber.Ctx) error {
	rc, _, ok := requireWritableRoomMember(c)
	if !ok {
		return nil
	}
	if !models.CanModerate(rc.Role) {
		return roomForbidden(c, "Only moderators can pin messages")
	}
	messageID, err := primitive.ObjectIDFromHex(c.Params("messageId"))
	if err != nil {
		return badRequest(c, "Invalid message ID")
	}
	var body struct {
		Pinned bool `json:"pinned"`
	}
	if err := c.BodyParser(&body); err != nil {
		return badRequest(c, "Invalid request")
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()
	result, err := config.DB.Collection(roomMessagesCollection).UpdateOne(ctx,
		bson.M{"_id": messageID, "roomId": rc.Room.ID, "deleted": false},
		bson.M{"$set": bson.M{"pinned": body.Pinned}})
	if err != nil {
		return serverError(c)
	}
	if result.MatchedCount == 0 {
		return roomNotFound(c)
	}
	realtime.NotifyRoom(rc.Room.ID.Hex(), "room:chat")
	return c.JSON(fiber.Map{"pinned": body.Pinned})
}
