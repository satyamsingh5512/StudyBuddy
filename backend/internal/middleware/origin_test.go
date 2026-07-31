package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func trustedOriginTestApp(t *testing.T) *fiber.App {
	t.Helper()
	t.Setenv("CLIENT_URL", "https://app.example.com/path")
	t.Setenv("NEXT_PUBLIC_APP_URL", "")
	t.Setenv("ALLOWED_ORIGINS", "https://preview.example.com/, invalid origin")

	app := fiber.New()
	app.Use(TrustedOrigin())
	app.All("/resource", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})
	return app
}

func TestTrustedOriginAllowsConfiguredBrowserMutation(t *testing.T) {
	app := trustedOriginTestApp(t)
	req := httptest.NewRequest(fiber.MethodPost, "/resource", nil)
	req.Header.Set(fiber.HeaderOrigin, "https://app.example.com")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("status = %d, want %d", resp.StatusCode, fiber.StatusNoContent)
	}
}

func TestTrustedOriginRejectsUntrustedBrowserMutation(t *testing.T) {
	app := trustedOriginTestApp(t)
	req := httptest.NewRequest(fiber.MethodDelete, "/resource", nil)
	req.Header.Set(fiber.HeaderOrigin, "https://attacker.example")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("status = %d, want %d", resp.StatusCode, fiber.StatusForbidden)
	}
}

func TestTrustedOriginAllowsSafeAndNonBrowserRequests(t *testing.T) {
	app := trustedOriginTestApp(t)
	tests := []struct {
		name   string
		method string
		origin string
	}{
		{name: "safe browser request", method: fiber.MethodGet, origin: "https://attacker.example"},
		{name: "non-browser mutation", method: fiber.MethodPatch},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/resource", nil)
			if tt.origin != "" {
				req.Header.Set(fiber.HeaderOrigin, tt.origin)
			}
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("app.Test() error = %v", err)
			}
			if resp.StatusCode != fiber.StatusNoContent {
				t.Fatalf("status = %d, want %d", resp.StatusCode, fiber.StatusNoContent)
			}
		})
	}
}
