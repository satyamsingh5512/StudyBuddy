package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestRateLimitRejectsRequestsOverWindow(t *testing.T) {
	app := fiber.New()
	app.Post("/limited", RateLimit(2, time.Minute), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	for attempt := 1; attempt <= 3; attempt++ {
		req := httptest.NewRequest(fiber.MethodPost, "/limited", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("attempt %d: app.Test() error = %v", attempt, err)
		}

		if attempt <= 2 {
			if resp.StatusCode != fiber.StatusNoContent {
				t.Fatalf("attempt %d: status = %d, want %d", attempt, resp.StatusCode, fiber.StatusNoContent)
			}
			continue
		}

		if resp.StatusCode != fiber.StatusTooManyRequests {
			t.Fatalf("attempt %d: status = %d, want %d", attempt, resp.StatusCode, fiber.StatusTooManyRequests)
		}
		if resp.Header.Get(fiber.HeaderRetryAfter) == "" {
			t.Fatal("rate-limited response did not include Retry-After")
		}
	}
}

func TestRateLimitResetsAfterWindow(t *testing.T) {
	app := fiber.New()
	app.Get("/limited", RateLimit(1, 5*time.Millisecond), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	request := func() int {
		t.Helper()
		resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/limited", nil))
		if err != nil {
			t.Fatalf("app.Test() error = %v", err)
		}
		return resp.StatusCode
	}

	if status := request(); status != fiber.StatusNoContent {
		t.Fatalf("first status = %d, want %d", status, fiber.StatusNoContent)
	}
	if status := request(); status != fiber.StatusTooManyRequests {
		t.Fatalf("second status = %d, want %d", status, fiber.StatusTooManyRequests)
	}

	time.Sleep(10 * time.Millisecond)
	if status := request(); status != fiber.StatusNoContent {
		t.Fatalf("status after reset = %d, want %d", status, fiber.StatusNoContent)
	}
}
