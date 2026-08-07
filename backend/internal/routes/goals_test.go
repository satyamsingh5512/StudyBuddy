package routes

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestGoalsRoutesRequireAuthentication(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	request := httptest.NewRequest("GET", "/api/goals", nil)
	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("GET /api/goals status = %d, want %d", response.StatusCode, fiber.StatusUnauthorized)
	}
}
