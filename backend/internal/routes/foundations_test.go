package routes

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestFoundationRoutesRequireAuthentication(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)
	tests := []struct{ method, path, body string }{
		{"GET", "/api/journal?from=2026-08-01&to=2026-08-07", ""},
		{"GET", "/api/journal/2026-08-07", ""},
		{"PUT", "/api/journal/2026-08-07", `{"markdown":"x","expectedRevision":0}`},
		{"DELETE", "/api/journal/2026-08-07", ""},
		{"POST", "/api/journal/attachments", ""},
		{"GET", "/api/journal/attachments/000000000000000000000000", ""},
		{"DELETE", "/api/journal/attachments/000000000000000000000000", ""},
		{"POST", "/api/mentor/respond", `{"message":"help"}`},
		{"GET", "/api/achievements", ""},
		{"POST", "/api/goals/show-ups/batch", `{"status":"complete"}`},
	}
	for _, test := range tests {
		req := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
		req.Header.Set("Content-Type", "application/json")
		response, err := app.Test(req)
		if err != nil {
			t.Fatalf("%s %s failed: %v", test.method, test.path, err)
		}
		response.Body.Close()
		if response.StatusCode != fiber.StatusUnauthorized {
			t.Errorf("%s %s status = %d, want 401", test.method, test.path, response.StatusCode)
		}
	}
}
