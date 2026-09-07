package handlers

import (
	"context"
	"strconv"
	"strings"
	"time"

	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/realtime"

	"github.com/gofiber/fiber/v2"
)

func realtimeWaitSeconds(raw string) int {
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds < 1 {
		return 25
	}
	if seconds > 25 {
		return 25
	}
	return seconds
}

func validRealtimeCursor(cursor string) bool {
	if cursor == "" {
		return true
	}
	parts := strings.Split(cursor, "-")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false
	}
	for _, part := range parts {
		if _, err := strconv.ParseUint(part, 10, 64); err != nil {
			return false
		}
	}
	return true
}

// GetRealtimeChanges returns invalidation topics from the user's durable Redis
// stream. Data remains on authenticated REST endpoints; this endpoint carries
// no document contents and cleanly reports disabled when REDIS_URL is absent.
func GetRealtimeChanges(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	cursor := c.Query("cursor")
	if !validRealtimeCursor(cursor) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid realtime cursor"})
	}
	wait := realtimeWaitSeconds(c.Query("timeout"))
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(wait+2)*time.Second)
	defer cancel()
	changes, err := realtime.ReadChanges(ctx, user.ID.Hex(), cursor, time.Duration(wait)*time.Second)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Realtime service unavailable"})
	}
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	return c.JSON(changes)
}
