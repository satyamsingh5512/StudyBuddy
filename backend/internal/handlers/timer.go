package handlers

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	defaultTimerAnalyticsDays = 7
	maxTimerAnalyticsDays     = 90
)

type TimerAnalyticsDay struct {
	Date           string         `json:"date"`
	StudyHours     float64        `json:"studyHours"`
	TasksCompleted int            `json:"tasksCompleted"`
	Understanding  float64        `json:"understanding"`
	Sessions       int            `json:"sessions"`
	SessionTypes   map[string]int `json:"sessionTypes"`
}

func parseTimerAnalyticsDays(raw string) int {
	if raw == "" {
		return defaultTimerAnalyticsDays
	}

	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 {
		return defaultTimerAnalyticsDays
	}

	if parsed > maxTimerAnalyticsDays {
		return maxTimerAnalyticsDays
	}

	return parsed
}

func toFloat64(value any) (float64, bool) {
	switch v := value.(type) {
	case int:
		return float64(v), true
	case int8:
		return float64(v), true
	case int16:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint8:
		return float64(v), true
	case uint16:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	case float32:
		return float64(v), true
	case float64:
		return v, true
	case primitive.Decimal128:
		parsed, err := strconv.ParseFloat(v.String(), 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, false
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func normalizeUnderstandingScore(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}

	if value < 0 {
		value = 0
	}

	if value > 10 && value <= 100 {
		value = value / 10.0
	} else if value > 0 && value <= 5 {
		value = value * 2.0
	}

	if value > 10 {
		value = 10
	}

	return value
}

func toReportDateKey(value any, loc *time.Location) (string, bool) {
	switch v := value.(type) {
	case time.Time:
		if v.IsZero() {
			return "", false
		}
		return dayStartInLocation(v, loc).Format("2006-01-02"), true
	case primitive.DateTime:
		t := v.Time()
		if t.IsZero() {
			return "", false
		}
		return dayStartInLocation(t, loc).Format("2006-01-02"), true
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return "", false
		}

		if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
			return dayStartInLocation(parsed, loc).Format("2006-01-02"), true
		}

		if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
			return dayStartInLocation(parsed, loc).Format("2006-01-02"), true
		}

		return "", false
	default:
		return "", false
	}
}

type SaveSessionRequest struct {
	Duration  int    `json:"duration"`
	Subject   string `json:"subject"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Timezone  string `json:"timezone"`
}

func localDayBounds(t time.Time, loc *time.Location) (time.Time, time.Time) {
	lt := t.In(loc)
	y, m, d := lt.Date()
	start := time.Date(y, m, d, 0, 0, 0, 0, loc)
	return start, start.AddDate(0, 0, 1)
}

func localDayGap(from, to time.Time, loc *time.Location) int {
	fromLocal := from.In(loc)
	toLocal := to.In(loc)
	fromStamp := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 12, 0, 0, 0, time.UTC)
	toStamp := time.Date(toLocal.Year(), toLocal.Month(), toLocal.Day(), 12, 0, 0, 0, time.UTC)
	return int(toStamp.Sub(fromStamp).Hours() / 24)
}

func SaveTimerSession(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req SaveSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	durationMinutes := req.Duration
	if durationMinutes < 0 {
		durationMinutes = 0
	}
	// Backward compatibility: older clients may send duration in seconds.
	if durationMinutes > 300 {
		durationMinutes = int(math.Round(float64(durationMinutes) / 60.0))
	}

	startTime := time.Now()
	if req.StartTime != "" {
		if parsed, err := time.Parse(time.RFC3339, req.StartTime); err == nil {
			startTime = parsed
		}
	}

	endTime := time.Now()
	if req.EndTime != "" {
		if parsed, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
			endTime = parsed
		}
	}

	if endTime.Before(startTime) {
		endTime = startTime.Add(time.Duration(durationMinutes) * time.Minute)
	}

	now := time.Now()
	location := time.UTC
	if req.Timezone != "" {
		if tz, err := time.LoadLocation(req.Timezone); err == nil {
			location = tz
		}
	}

	session := models.Session{
		UserID:    user.ID,
		Duration:  durationMinutes,
		Subject:   req.Subject,
		StartTime: startTime,
		EndTime:   endTime,
		CreatedAt: now,
	}

	collection := config.DB.Collection("timer_sessions")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, session)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save session"})
	}

	session.ID = res.InsertedID.(primitive.ObjectID)

	pointsEarned := durationMinutes
	streakAfterSave := user.Streak

	usersCollection := config.DB.Collection("users")
	updateSet := bson.M{"lastActive": now, "updatedAt": now}

	if durationMinutes > 0 {
		sessionDayStart, nextDayStart := localDayBounds(now, location)

		// Only the first non-zero saved session for the user's local day can change streak.
		todaySessionCount, countErr := collection.CountDocuments(ctx, bson.M{
			"userId":    user.ID,
			"duration":  bson.M{"$gt": 0},
			"createdAt": bson.M{"$gte": sessionDayStart, "$lt": nextDayStart},
		})

		if countErr == nil && todaySessionCount == 1 {
			nextStreak := 1

			var prevSession models.Session
			prevErr := collection.FindOne(
				ctx,
				bson.M{
					"userId":    user.ID,
					"duration":  bson.M{"$gt": 0},
					"createdAt": bson.M{"$lt": sessionDayStart},
				},
				options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}}),
			).Decode(&prevSession)

			if prevErr == nil {
				gapDays := localDayGap(prevSession.CreatedAt, now, location)

				if gapDays == 1 {
					baseStreak := user.Streak
					if baseStreak < 1 {
						baseStreak = 1
					}
					nextStreak = baseStreak + 1
				}
			}

			if prevErr == nil || prevErr == mongo.ErrNoDocuments {
				streakAfterSave = nextStreak
				updateSet["streak"] = nextStreak
			}
		}
	}

	usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$inc": bson.M{"totalStudyMinutes": durationMinutes, "totalPoints": pointsEarned},
		"$set": updateSet,
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":      "Session saved",
		"pointsEarned": pointsEarned,
		"streak":       streakAfterSave,
		"session":      session,
	})
}

func GetTimerAnalytics(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	days := parseTimerAnalyticsDays(c.Query("days"))

	now := time.Now()
	loc := now.Location()
	if tzName := strings.TrimSpace(c.Query("timezone")); tzName != "" {
		if tz, err := time.LoadLocation(tzName); err == nil {
			loc = tz
		}
	}

	startOfToday := dayStartInLocation(now, loc)
	rangeStart := startOfToday.AddDate(0, 0, -(days - 1))
	rangeEnd := startOfToday.Add(24 * time.Hour)

	analyticsByDay := make(map[string]*TimerAnalyticsDay, days)
	orderedDays := make([]*TimerAnalyticsDay, 0, days)
	for i := 0; i < days; i++ {
		day := rangeStart.AddDate(0, 0, i)
		dateKey := day.Format("2006-01-02")

		entry := &TimerAnalyticsDay{
			Date:         dateKey,
			SessionTypes: map[string]int{},
		}

		analyticsByDay[dateKey] = entry
		orderedDays = append(orderedDays, entry)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	timerCollection := config.DB.Collection("timer_sessions")
	timerCursor, err := timerCollection.Find(ctx, bson.M{
		"userId": user.ID,
		"$or": []bson.M{
			{
				"startTime": bson.M{
					"$gte": rangeStart,
					"$lt":  rangeEnd,
				},
			},
			{
				"createdAt": bson.M{
					"$gte": rangeStart,
					"$lt":  rangeEnd,
				},
			},
		},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch analytics"})
	}
	defer timerCursor.Close(ctx)

	var sessions []models.Session
	if err = timerCursor.All(ctx, &sessions); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse analytics"})
	}

	for _, session := range sessions {
		referenceTime := session.StartTime
		if referenceTime.IsZero() {
			referenceTime = session.CreatedAt
		}
		if referenceTime.IsZero() {
			continue
		}

		dateKey := dayStartInLocation(referenceTime, loc).Format("2006-01-02")
		day := analyticsByDay[dateKey]
		if day == nil {
			continue
		}

		durationMinutes := normalizeDurationMinutes(session.Duration)
		if durationMinutes < 0 {
			durationMinutes = 0
		}

		day.StudyHours += float64(durationMinutes) / 60.0
		day.Sessions++

		subject := strings.TrimSpace(session.Subject)
		if subject == "" {
			subject = "General"
		}
		day.SessionTypes[subject] = day.SessionTypes[subject] + 1
	}

	todosCollection := config.DB.Collection("todos")
	todosCursor, err := todosCollection.Find(ctx, bson.M{
		"userId":    user.ID,
		"completed": true,
		"dueDate": bson.M{
			"$gte": rangeStart,
			"$lt":  rangeEnd,
		},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch analytics"})
	}
	defer todosCursor.Close(ctx)

	var todos []models.Todo
	if err := todosCursor.All(ctx, &todos); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse analytics"})
	}

	for _, todo := range todos {
		if todo.DueDate == nil {
			continue
		}

		dateKey := dayStartInLocation(*todo.DueDate, loc).Format("2006-01-02")
		day := analyticsByDay[dateKey]
		if day == nil {
			continue
		}

		day.TasksCompleted++
	}

	reportsCollection := config.DB.Collection("daily_reports")
	reportsCursor, err := reportsCollection.Find(ctx, bson.M{
		"userId": user.ID,
		"date": bson.M{
			"$gte": rangeStart,
			"$lt":  rangeEnd,
		},
	})
	if err == nil {
		defer reportsCursor.Close(ctx)

		var reports []bson.M
		if err := reportsCursor.All(ctx, &reports); err == nil {
			for _, report := range reports {
				dateKey, ok := toReportDateKey(report["date"], loc)
				if !ok {
					continue
				}

				day := analyticsByDay[dateKey]
				if day == nil {
					continue
				}

				if tasksCompleted, ok := toFloat64(report["tasksCompleted"]); ok {
					parsedTasks := int(math.Round(tasksCompleted))
					if parsedTasks > day.TasksCompleted {
						day.TasksCompleted = parsedTasks
					}
				}

				if understanding, ok := toFloat64(report["understanding"]); ok {
					day.Understanding = normalizeUnderstandingScore(understanding)
				} else if completionPct, ok := toFloat64(report["completionPct"]); ok && day.Understanding == 0 {
					day.Understanding = normalizeUnderstandingScore(completionPct)
				}
			}
		}
	}

	response := make([]TimerAnalyticsDay, 0, len(orderedDays))
	for _, day := range orderedDays {
		day.StudyHours = math.Round(day.StudyHours*10) / 10
		day.Understanding = math.Round(day.Understanding*10) / 10
		response = append(response, *day)
	}

	return c.JSON(response)
}
