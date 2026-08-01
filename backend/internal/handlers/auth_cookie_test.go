package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestSetSessionCookieProductionAttributes(t *testing.T) {
	t.Setenv("NODE_ENV", "production")

	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		setSessionCookie(c, "session-token")
		return c.SendStatus(fiber.StatusNoContent)
	})

	response, err := app.Test(httptest.NewRequest("GET", "http://example.test/", nil))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	cookies := response.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("received %d cookies, want 1", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != sessionCookieName || cookie.Value != "session-token" {
		t.Fatalf("unexpected session cookie: %#v", cookie)
	}
	if cookie.Path != "/" || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteNoneMode {
		t.Fatalf("session cookie is missing production attributes: %#v", cookie)
	}
}

func TestGoogleCallbackURLUsesAppOriginByDefault(t *testing.T) {
	t.Setenv("GOOGLE_CALLBACK_URL", "")
	t.Setenv("CLIENT_URL", "https://sbd.satym.in/")
	t.Setenv("NEXT_PUBLIC_APP_URL", "")

	got := googleCallbackURL(nil)
	want := "https://sbd.satym.in/api/auth/google/callback"
	if got != want {
		t.Fatalf("googleCallbackURL() = %q, want %q", got, want)
	}
}

func TestGoogleCallbackURLAllowsExplicitOverride(t *testing.T) {
	t.Setenv("GOOGLE_CALLBACK_URL", "https://preview.example/api/auth/google/callback")
	t.Setenv("CLIENT_URL", "https://sbd.satym.in")

	got := googleCallbackURL(nil)
	want := "https://preview.example/api/auth/google/callback"
	if got != want {
		t.Fatalf("googleCallbackURL() = %q, want %q", got, want)
	}
}
