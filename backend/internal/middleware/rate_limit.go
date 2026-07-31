package middleware

import (
	"fmt"
	"sync"
	"time"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

type rateWindow struct {
	count     int
	expiresAt time.Time
}

func RateLimit(max int, window time.Duration) fiber.Handler {
	var mu sync.Mutex
	clients := make(map[string]rateWindow)
	lastCleanup := time.Now()

	return func(c *fiber.Ctx) error {
		now := time.Now()
		key := c.IP()
		if user, ok := c.Locals("user").(models.User); ok {
			key = user.ID.Hex()
		}

		mu.Lock()
		if now.Sub(lastCleanup) >= window {
			for client, state := range clients {
				if !state.expiresAt.After(now) {
					delete(clients, client)
				}
			}
			lastCleanup = now
		}

		state := clients[key]
		if !state.expiresAt.After(now) {
			state = rateWindow{expiresAt: now.Add(window)}
		}
		state.count++
		clients[key] = state
		allowed := state.count <= max
		retryAfter := time.Until(state.expiresAt)
		mu.Unlock()

		if !allowed {
			seconds := int(retryAfter.Seconds())
			if seconds < 1 {
				seconds = 1
			}
			c.Set(fiber.HeaderRetryAfter, fmt.Sprintf("%d", seconds))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Too many requests. Please try again later.",
				"message": "Too many requests. Please try again later.",
			})
		}

		return c.Next()
	}
}
