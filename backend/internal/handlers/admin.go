package handlers

import (
	"context"
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const maxDailyStatsRecipients = 500

var tempEmailDomains = []string{"tempmail", "10minutemail", "guerrillamail", "mailinator", "trashmail"}

// isTempEmail reports whether the address belongs to a disposable-email domain.
func isTempEmail(email string) bool {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 {
		return false
	}
	for _, td := range tempEmailDomains {
		if strings.Contains(parts[1], td) {
			return true
		}
	}
	return false
}

// sumTimerMinutes totals today's studied minutes for one user.
func sumTimerMinutes(ctx context.Context, timerColl *mongo.Collection, userID primitive.ObjectID, start time.Time) int {
	cursor, err := timerColl.Aggregate(ctx, bson.A{
		bson.M{"$match": bson.M{"userId": userID, "createdAt": bson.M{"$gte": start}}},
		bson.M{"$group": bson.M{"_id": nil, "minutes": bson.M{"$sum": "$duration"}}},
	})
	if err != nil {
		return 0
	}
	defer cursor.Close(ctx)
	var rows []bson.M
	if err := cursor.All(ctx, &rows); err != nil || len(rows) == 0 {
		return 0
	}
	switch v := rows[0]["minutes"].(type) {
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

// countTodosCompleted counts one user's todos completed since start.
func countTodosCompleted(ctx context.Context, todosColl *mongo.Collection, userID primitive.ObjectID, start time.Time) int {
	count, err := todosColl.CountDocuments(ctx, bson.M{
		"userId": userID, "completed": true, "completedAt": bson.M{"$gte": start},
	})
	if err != nil || count < 0 {
		return 0
	}
	return int(count)
}

func adminEmailsFromEnv() []string {
	return []string{
		strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))),
		strings.ToLower(strings.TrimSpace(os.Getenv("NEXT_PUBLIC_ADMIN_EMAIL"))),
	}
}

// isAdminUser reports whether the account may use admin endpoints: either an
// explicit admin role or an email allowlisted in ADMIN_EMAIL (preferred) or
// NEXT_PUBLIC_ADMIN_EMAIL (compatibility). Comparison is case-insensitive so
// "User@Example.com" in the env still matches the normalized stored email.
func isAdminUser(user models.User) bool {
	if strings.TrimSpace(user.Role) == "admin" {
		return true
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return false
	}
	for _, adminEmail := range adminEmailsFromEnv() {
		if adminEmail != "" && email == adminEmail {
			return true
		}
	}
	return false
}

func adminForbidden(c *fiber.Ctx) error {
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
		"error":   "Forbidden",
		"message": "This account is not an admin. Set ADMIN_EMAIL (or NEXT_PUBLIC_ADMIN_EMAIL) to your login email.",
	})
}

// dayStart returns local midnight for day-bucketed admin counters.
func dayStart(now time.Time) time.Time {
	y, m, d := now.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, now.Location())
}

func requireDB(c *fiber.Ctx) bool {
	if config.DB == nil {
		_ = c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database is not connected"})
		return false
	}
	return true
}

func GetAdminStats(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	if !isAdminUser(user) {
		return adminForbidden(c)
	}
	if !requireDB(c) {
		return nil
	}

	usersColl := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	startOfToday := dayStart(time.Now())

	// Use aggregation to get all counts in one query
	pipeline := bson.A{
		bson.M{"$facet": bson.M{
			"totalUsers":    []bson.M{{"$count": "count"}},
			"verifiedUsers": []bson.M{{"$match": bson.M{"emailVerified": true}}, {"$count": "count"}},
			"activeToday":   []bson.M{{"$match": bson.M{"lastActive": bson.M{"$gte": startOfToday}}}, {"$count": "count"}},
		}},
	}
	aggCursor, err := usersColl.Aggregate(ctx, pipeline)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Aggregation error"})
	}
	var aggResult []bson.M
	if err := aggCursor.All(ctx, &aggResult); err != nil || len(aggResult) == 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Aggregation result error"})
	}
	facet := aggResult[0]
	getCount := func(key string) int64 {
		arr, ok := facet[key].(primitive.A)
		if !ok || len(arr) == 0 {
			return 0
		}
		doc, ok := arr[0].(bson.M)
		if !ok {
			return 0
		}

		switch v := doc["count"].(type) {
		case int32:
			return int64(v)
		case int64:
			return v
		case float64:
			return int64(v)
		default:
			return 0
		}
	}

	totalUsers := getCount("totalUsers")
	verifiedUsers := getCount("verifiedUsers")
	activeToday := getCount("activeToday")

	// Only fetch emails for temp-domain check (projection keeps payload small).
	emailCursor, err := usersColl.Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"email": 1}))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Email fetch error"})
	}
	defer emailCursor.Close(ctx)

	type EmailDoc struct {
		Email string `bson:"email"`
	}
	tempEmailUsers := 0
	for emailCursor.Next(ctx) {
		var doc EmailDoc
		if err := emailCursor.Decode(&doc); err == nil && isTempEmail(doc.Email) {
			tempEmailUsers++
		}
	}
	if err := emailCursor.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Email cursor error"})
	}

	return c.JSON(fiber.Map{
		"totalUsers":     totalUsers,
		"verifiedUsers":  verifiedUsers,
		"activeToday":    activeToday,
		"tempEmailUsers": tempEmailUsers,
		"timestamp":      time.Now(),
	})
}

func SendDailyStats(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	if !isAdminUser(user) {
		return adminForbidden(c)
	}
	if !requireDB(c) {
		return nil
	}
	if !services.EmailSendingConfigured() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Email service is not configured",
			"message": "Set RESEND_API_KEY (or ZEPTOMAIL_SMTP_USER, ZEPTOMAIL_SMTP_PASSWORD and EMAIL_FROM) to send daily stats.",
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	startOfToday := dayStart(time.Now())
	dateLabel := startOfToday.Format("2006-01-02")

	type recipient struct {
		ID          primitive.ObjectID `bson:"_id"`
		Name        string             `bson:"name"`
		Email       string             `bson:"email"`
		Streak      int                `bson:"streak"`
		TotalPoints int                `bson:"totalPoints"`
	}
	cursor, err := config.DB.Collection("users").Find(ctx,
		bson.M{"emailVerified": true, "email": bson.M{"$exists": true, "$ne": ""}},
		options.Find().
			SetProjection(bson.M{"name": 1, "email": 1, "streak": 1, "totalPoints": 1}).
			SetLimit(maxDailyStatsRecipients),
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load recipients"})
	}
	defer cursor.Close(ctx)

	timerColl := config.DB.Collection("timer_sessions")
	todosColl := config.DB.Collection("todos")

	var successCount, failCount, skippedTempEmails int64
	var totalUsers int64
	for cursor.Next(ctx) {
		var r recipient
		if err := cursor.Decode(&r); err != nil {
			continue
		}
		email := strings.TrimSpace(r.Email)
		if email == "" {
			continue
		}
		totalUsers++
		if isTempEmail(email) {
			skippedTempEmails++
			continue
		}

		minutes := sumTimerMinutes(ctx, timerColl, r.ID, startOfToday)
		completed := countTodosCompleted(ctx, todosColl, r.ID, startOfToday)

		if err := services.SendDailyStatsEmail(email, r.Name, minutes, completed, r.Streak, r.TotalPoints, dateLabel); err != nil {
			failCount++
			continue
		}
		successCount++
	}
	if err := cursor.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read recipients"})
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"message":           "Daily stats emails processed",
		"successCount":      successCount,
		"failCount":         failCount,
		"skippedTempEmails": skippedTempEmails,
		"totalUsers":        totalUsers,
	})
}
