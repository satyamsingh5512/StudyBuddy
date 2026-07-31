package middleware

import (
	"os"
	"strings"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func RequireAdmin(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(models.User)
	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	if !ok || (user.Role != "admin" && (adminEmail == "" || strings.ToLower(user.Email) != adminEmail)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "Forbidden",
		})
	}
	return c.Next()
}
