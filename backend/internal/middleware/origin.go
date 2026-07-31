package middleware

import (
	"net/url"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func TrustedOrigin() fiber.Handler {
	allowed := trustedOrigins()

	return func(c *fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet, fiber.MethodHead, fiber.MethodOptions:
			return c.Next()
		}

		origin := strings.TrimRight(strings.TrimSpace(c.Get(fiber.HeaderOrigin)), "/")
		// Non-browser clients may not send Origin. Browsers include it on cross-origin
		// credentialed mutations, which is the CSRF case this middleware prevents.
		if origin == "" {
			return c.Next()
		}
		if _, ok := allowed[origin]; !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "Untrusted request origin",
				"message": "Untrusted request origin",
			})
		}
		return c.Next()
	}
}

func trustedOrigins() map[string]struct{} {
	allowed := map[string]struct{}{
		"http://localhost:3000": {},
		"http://127.0.0.1:3000": {},
	}
	values := []string{os.Getenv("CLIENT_URL"), os.Getenv("NEXT_PUBLIC_APP_URL")}
	values = append(values, strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")...)
	for _, value := range values {
		value = strings.TrimRight(strings.TrimSpace(value), "/")
		if value == "" {
			continue
		}
		if !strings.Contains(value, "://") {
			value = "https://" + value
		}
		parsed, err := url.Parse(value)
		if err == nil && parsed.Scheme != "" && parsed.Host != "" {
			allowed[parsed.Scheme+"://"+parsed.Host] = struct{}{}
		}
	}
	return allowed
}
