package middleware

import (
	"os"
	"strings"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// IsAdminAccount mirrors handlers.isAdminUser: an explicit admin role or an
// email allowlisted in ADMIN_EMAIL (preferred) or NEXT_PUBLIC_ADMIN_EMAIL
// (compatibility). Kept here so route middleware and handlers agree; the two
// packages cannot share the helper without an import cycle.
func IsAdminAccount(user models.User) bool {
	if strings.TrimSpace(user.Role) == "admin" {
		return true
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return false
	}
	for _, key := range []string{"ADMIN_EMAIL", "NEXT_PUBLIC_ADMIN_EMAIL"} {
		if adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv(key))); adminEmail != "" && email == adminEmail {
			return true
		}
	}
	return false
}

func RequireAdmin(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(models.User)
	if !ok || !IsAdminAccount(user) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "This account is not an admin. Set ADMIN_EMAIL (or NEXT_PUBLIC_ADMIN_EMAIL) to your login email.",
		})
	}
	return c.Next()
}
