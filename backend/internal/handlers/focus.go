package handlers

import (
	"context"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/realtime"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// focusHeartbeatTTL: readers treat a session as live only while the heartbeat
// is fresher than this. Writers heartbeat every ~20s.
const focusHeartbeatTTL = 90 * time.Second

type focusStartRequest struct {
	DeviceID        string `json:"deviceId"`
	Subject         string `json:"subject"`
	DurationMinutes int    `json:"durationMinutes"`
}

type focusHeartbeatRequest struct {
	DeviceID string `json:"deviceId"`
}

type focusEndRequest struct {
	DeviceID  string `json:"deviceId"`
	EndReason string `json:"endReason"`
}

func focusCollection() string { return "focus_sessions" }

func findLiveFocusSession(ctx context.Context, userID interface{}) (*models.FocusSession, error) {
	var session models.FocusSession
	err := config.DB.Collection(focusCollection()).FindOne(
		ctx,
		bson.M{
			"userId":      userID,
			"active":      true,
			"heartbeatAt": bson.M{"$gte": time.Now().Add(-focusHeartbeatTTL)},
		},
		options.FindOne().SetSort(bson.D{{Key: "heartbeatAt", Value: -1}}),
	).Decode(&session)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// StartFocusSession begins (or takes over) the user's live focus session.
func StartFocusSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var req focusStartRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	deviceID := strings.TrimSpace(req.DeviceID)
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deviceId is required"})
	}
	now := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	coll := config.DB.Collection(focusCollection())

	// A reload or reconnect from the SAME device is a heartbeat, not a new
	// focus session. This preserves startedAt and avoids briefly taking over
	// the user's own session while FocusGuard remounts.
	var existing models.FocusSession
	if err := coll.FindOne(ctx, bson.M{"userId": user.ID, "deviceId": deviceID, "active": true}).Decode(&existing); err == nil {
		updates := bson.M{"heartbeatAt": now, "updatedAt": now}
		if subject := strings.TrimSpace(req.Subject); subject != "" {
			updates["subject"] = subject
			existing.Subject = subject
		}
		if req.DurationMinutes > 0 {
			updates["durationMinutes"] = req.DurationMinutes
			existing.DurationMinutes = req.DurationMinutes
		}
		if _, updateErr := coll.UpdateOne(ctx, bson.M{"_id": existing.ID}, bson.M{"$set": updates}); updateErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to refresh focus session"})
		}
		realtime.NotifyChange(user.ID.Hex(), "focus")
		return c.JSON(fiber.Map{
			"active":    true,
			"deviceId":  deviceID,
			"startedAt": existing.StartedAt,
			"subject":   existing.Subject,
		})
	}

	// Single active session per user: close any live session from another device.
	_, _ = coll.UpdateMany(ctx,
		bson.M{"userId": user.ID, "active": true},
		bson.M{"$set": bson.M{"active": false, "endReason": "taken-over", "updatedAt": now}},
	)

	session := models.FocusSession{
		UserID:          user.ID,
		DeviceID:        deviceID,
		Subject:         strings.TrimSpace(req.Subject),
		DurationMinutes: req.DurationMinutes,
		StartedAt:       now,
		HeartbeatAt:     now,
		Active:          true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	inserted := false
	for attempt := 0; attempt < 3; attempt++ {
		_, err := coll.InsertOne(ctx, session)
		if err == nil {
			inserted = true
			break
		}
		if !mongo.IsDuplicateKeyError(err) {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start focus session"})
		}
		// A simultaneous start won the partial unique index. Take over that
		// just-created active session and retry a bounded number of times.
		_, _ = coll.UpdateMany(ctx,
			bson.M{"userId": user.ID, "active": true},
			bson.M{"$set": bson.M{"active": false, "endReason": "taken-over", "updatedAt": time.Now()}},
		)
	}
	if !inserted {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Focus session start is contended; retry shortly"})
	}
	realtime.NotifyChange(user.ID.Hex(), "focus")
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"active":    true,
		"deviceId":  deviceID,
		"startedAt": now,
		"subject":   session.Subject,
	})
}

// HeartbeatFocusSession keeps the live session fresh (call every ~20s while focusing).
func HeartbeatFocusSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var req focusHeartbeatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	deviceID := strings.TrimSpace(req.DeviceID)
	now := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	filter := bson.M{"userId": user.ID, "active": true}
	if deviceID != "" {
		filter["deviceId"] = deviceID
	}
	res, err := config.DB.Collection(focusCollection()).UpdateOne(ctx, filter,
		bson.M{"$set": bson.M{"heartbeatAt": now, "updatedAt": now}})
	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"active": false})
	}
	return c.JSON(fiber.Map{"active": true, "heartbeatAt": now})
}

// EndFocusSession closes the live session (completed, cancelled, phone-interrupt, …).
func EndFocusSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var req focusEndRequest
	_ = c.BodyParser(&req)
	deviceID := strings.TrimSpace(req.DeviceID)
	reason := strings.TrimSpace(req.EndReason)
	if reason == "" {
		reason = "ended"
	}
	now := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	filter := bson.M{"userId": user.ID, "active": true}
	if deviceID != "" {
		filter["deviceId"] = deviceID
	}
	_, err := config.DB.Collection(focusCollection()).UpdateMany(ctx, filter,
		bson.M{"$set": bson.M{"active": false, "endReason": reason, "updatedAt": now}})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to end focus session"})
	}
	realtime.NotifyChange(user.ID.Hex(), "focus")
	return c.JSON(fiber.Map{"active": false, "endReason": reason})
}

// GetActiveFocusSession reports the user's live session, if any.
// Other devices poll this to show the "you are on a focus session" guard.
func GetActiveFocusSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	session, err := findLiveFocusSession(ctx, user.ID)
	if err != nil {
		return c.JSON(fiber.Map{"active": false})
	}
	return c.JSON(fiber.Map{
		"active":          true,
		"deviceId":        session.DeviceID,
		"subject":         session.Subject,
		"durationMinutes": session.DurationMinutes,
		"startedAt":       session.StartedAt,
		"heartbeatAt":     session.HeartbeatAt,
	})
}
