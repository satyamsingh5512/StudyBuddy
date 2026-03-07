package main

import (
	"log"
	"os"
	"sort"
	"strings"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func normalizeOrigin(origin string) string {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" || trimmed == "*" {
		return ""
	}
	return strings.TrimRight(trimmed, "/")
}

func buildAllowedOrigins() string {
	originsSet := map[string]struct{}{}
	add := func(origin string) {
		if normalized := normalizeOrigin(origin); normalized != "" {
			originsSet[normalized] = struct{}{}
		}
	}

	for _, origin := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		add(origin)
	}
	add(os.Getenv("CLIENT_URL"))
	add(os.Getenv("NEXT_PUBLIC_APP_URL"))

	// Always keep local development origins available.
	add("http://localhost:3000")
	add("http://127.0.0.1:3000")

	origins := make([]string, 0, len(originsSet))
	for origin := range originsSet {
		origins = append(origins, origin)
	}
	sort.Strings(origins)

	return strings.Join(origins, ",")
}

func main() {
	if os.Getenv("NODE_ENV") != "production" {
		_ = godotenv.Load("../.env")
	}

	app := fiber.New(fiber.Config{
		AppName: "StudyBuddy API",
	})

	app.Use(logger.New())
	allowedOrigins := buildAllowedOrigins()
	log.Printf("CORS allowed origins: %s", allowedOrigins)
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		MaxAge:           300,
	}))

	config.ConnectDB()

	routes.SetupRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}
