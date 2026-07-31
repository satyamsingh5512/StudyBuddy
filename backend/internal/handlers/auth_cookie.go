package handlers

import (
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
)

const sessionCookieName = "connect.sid"

func setSessionCookie(c *fiber.Ctx, token string) {
	secure := os.Getenv("NODE_ENV") == "production" || c.Protocol() == "https"
	sameSite := "lax"
	if secure {
		// Production may serve the API from a separate site. Secure is mandatory
		// when SameSite=None; trusted-origin checks protect state-changing calls.
		sameSite = "none"
	}

	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(session.Duration),
		HTTPOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
}

func clearSessionCookie(c *fiber.Ctx) {
	secure := os.Getenv("NODE_ENV") == "production" || c.Protocol() == "https"
	sameSite := "lax"
	if secure {
		sameSite = "none"
	}

	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   secure,
		SameSite: strings.ToLower(sameSite),
	})
}
