package routes

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// Every room route must be authenticated. A room route that answers anything
// other than 401 without a session cookie is a data leak, so this asserts the
// whole surface rather than a sample.
func TestRoomRoutesRequireAuthentication(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	const roomID = "651f1f77bcf86cd799439011"
	const userID = "651f1f77bcf86cd799439012"
	const messageID = "651f1f77bcf86cd799439013"
	const sessionID = "651f1f77bcf86cd799439014"

	routes := []struct{ method, path string }{
		{"GET", "/api/rooms"},
		{"POST", "/api/rooms"},
		{"GET", "/api/rooms/mine"},
		{"GET", "/api/rooms/leaderboard"},
		{"GET", "/api/rooms/achievements"},
		{"GET", "/api/rooms/" + roomID},
		{"PATCH", "/api/rooms/" + roomID},
		{"DELETE", "/api/rooms/" + roomID},
		{"POST", "/api/rooms/" + roomID + "/restore"},
		{"POST", "/api/rooms/" + roomID + "/transfer/" + userID},
		{"POST", "/api/rooms/" + roomID + "/join"},
		{"POST", "/api/rooms/" + roomID + "/leave"},
		{"GET", "/api/rooms/" + roomID + "/members"},
		{"PATCH", "/api/rooms/" + roomID + "/members/" + userID},
		{"GET", "/api/rooms/" + roomID + "/presence"},
		{"POST", "/api/rooms/" + roomID + "/presence"},
		{"GET", "/api/rooms/" + roomID + "/changes"},
		{"GET", "/api/rooms/" + roomID + "/messages"},
		{"POST", "/api/rooms/" + roomID + "/messages"},
		{"POST", "/api/rooms/" + roomID + "/messages/" + messageID + "/reactions"},
		{"PATCH", "/api/rooms/" + roomID + "/messages/" + messageID + "/pin"},
		{"DELETE", "/api/rooms/" + roomID + "/messages/" + messageID},
		{"POST", "/api/rooms/" + roomID + "/sessions"},
		{"GET", "/api/rooms/" + roomID + "/sessions/active"},
		{"POST", "/api/rooms/" + roomID + "/sessions/" + sessionID + "/join"},
		{"POST", "/api/rooms/" + roomID + "/sessions/" + sessionID + "/complete"},
		{"GET", "/api/rooms/" + roomID + "/leaderboard"},
	}

	for _, route := range routes {
		request := httptest.NewRequest(route.method, route.path, strings.NewReader("{}"))
		request.Header.Set("Content-Type", "application/json")
		response, err := app.Test(request)
		if err != nil {
			t.Fatalf("%s %s failed: %v", route.method, route.path, err)
		}
		status := response.StatusCode
		_ = response.Body.Close()
		if status == fiber.StatusNotFound || status == fiber.StatusMethodNotAllowed {
			t.Errorf("%s %s is not registered (status %d)", route.method, route.path, status)
			continue
		}
		if status != fiber.StatusUnauthorized {
			t.Errorf("%s %s status = %d, want %d", route.method, route.path, status, fiber.StatusUnauthorized)
		}
	}
}

// Literal collection paths must win over /:id, otherwise "mine" would be parsed
// as a room ID and these endpoints would 400 or leak into the wrong handler.
func TestRoomLiteralPathsAreNotCapturedByIDParameter(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	for _, path := range []string{"/api/rooms/mine", "/api/rooms/leaderboard", "/api/rooms/achievements"} {
		request := httptest.NewRequest("GET", path, nil)
		response, err := app.Test(request)
		if err != nil {
			t.Fatalf("%s failed: %v", path, err)
		}
		status := response.StatusCode
		_ = response.Body.Close()
		// Unauthenticated is the correct answer; a 400 "Invalid room ID" would
		// prove the request reached GetRoom through /:id instead.
		if status != fiber.StatusUnauthorized {
			t.Errorf("%s status = %d, want %d", path, status, fiber.StatusUnauthorized)
		}
	}
}
