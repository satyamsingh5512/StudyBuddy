package routes

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func postJSON(t *testing.T, app *fiber.App, path, body string) int {
	t.Helper()
	req := httptest.NewRequest("POST", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response, err := app.Test(req)
	if err != nil {
		t.Fatalf("POST %s failed: %v", path, err)
	}
	defer response.Body.Close()
	return response.StatusCode
}

// A malformed address must be rejected before any database work, so this holds
// without a Mongo connection. If validation regressed, the handler would reach
// the nil collection and fail instead of returning 400.
func TestWaitlistRejectsInvalidEmailBeforeTouchingTheDatabase(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	for _, body := range []string{
		`{"email":"not-an-email"}`,
		`{"email":""}`,
		`{"email":"   "}`,
		`{"email":"two@addresses.com, other@example.com"}`,
		`{}`,
	} {
		if status := postJSON(t, app, "/api/waitlist", body); status != fiber.StatusBadRequest {
			t.Errorf("waitlist body %s status = %d, want 400", body, status)
		}
	}
}

func TestWaitlistIsRateLimitedForUnauthenticatedCallers(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	// Valid addresses would reach the database, so drive the limiter with
	// rejected payloads: the limiter runs before the handler either way.
	limited := false
	for attempt := 0; attempt < 12; attempt++ {
		if postJSON(t, app, "/api/waitlist", `{"email":"not-an-email"}`) == fiber.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("public waitlist endpoint accepted unlimited unauthenticated requests")
	}
}

// The public route is the one that serves signup, and it must stay reachable
// without a session after the shadowed protected duplicate was removed.
func TestPublicUsernameCheckIsReachableAndRateLimited(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	// A too-short username is answered from validation alone, with no database
	// access, so a 200 here proves the public route is still wired up.
	req := httptest.NewRequest("GET", "/api/username/check/ab", nil)
	response, err := app.Test(req)
	if err != nil {
		t.Fatalf("GET username check failed: %v", err)
	}
	response.Body.Close()
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("public username check status = %d, want 200", response.StatusCode)
	}

	limited := false
	for attempt := 0; attempt < 120; attempt++ {
		probe := httptest.NewRequest("GET", "/api/username/check/ab", nil)
		result, err := app.Test(probe)
		if err != nil {
			t.Fatalf("GET username check failed: %v", err)
		}
		status := result.StatusCode
		result.Body.Close()
		if status == fiber.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("public username check accepted unlimited enumeration requests")
	}
}
