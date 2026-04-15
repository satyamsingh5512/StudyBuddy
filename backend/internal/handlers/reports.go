package handlers

import (
	"context"
	"math"
	"strconv"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Report struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"userId" json:"-"`
	Date          time.Time          `bson:"date" json:"date"`
	StudyHours    float64            `bson:"studyHours" json:"studyHours"`
	HoursLogged   float64            `bson:"hoursLogged" json:"hoursLogged"`
	PointsEarned  int                `bson:"pointsEarned" json:"pointsEarned"`
	CompletionPct float64            `bson:"completionPct" json:"completionPct"`
	Notes         string             `bson:"notes" json:"notes"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type DailyEfficiencyResponse struct {
	Date                    string  `json:"date"`
	ScheduledTasks          int64   `json:"scheduledTasks"`
	CompletedTasks          int64   `json:"completedTasks"`
	TaskCompletionPct       float64 `json:"taskCompletionPct"`
	TimerStarts             int     `json:"timerStarts"`
	TimerCompletedSessions  int     `json:"timerCompletedSessions"`
	ProductiveTimerStarts   int     `json:"productiveTimerStarts"`
	AbandonedTimerStarts    int     `json:"abandonedTimerStarts"`
	ShortTimerStarts        int     `json:"shortTimerStarts"`
	TimerUsedMinutes        int     `json:"timerUsedMinutes"`
	TimerTimeTakenMinutes   float64 `json:"timerTimeTakenMinutes"`
	TimerStartCompletionPct float64 `json:"timerStartCompletionPct"`
	TimerUsagePct           float64 `json:"timerUsagePct"`
	TimerMinutesPct         float64 `json:"timerMinutesPct"`
	AbandonRatePct          float64 `json:"abandonRatePct"`
	ShortStartRatePct       float64 `json:"shortStartRatePct"`
	StrictPenaltyPoints     float64 `json:"strictPenaltyPoints"`
	FocusSessionThreshold   int     `json:"focusSessionThreshold"`
	DailyMinutesBenchmark   int     `json:"dailyMinutesBenchmark"`
	OverallEfficiencyPct    float64 `json:"overallEfficiencyPct"`
}

type EfficiencyTrendResponse struct {
	Days                        int                       `json:"days"`
	Trend                       []DailyEfficiencyResponse `json:"trend"`
	AverageOverallEfficiencyPct float64                   `json:"averageOverallEfficiencyPct"`
	AverageTaskCompletionPct    float64                   `json:"averageTaskCompletionPct"`
	AverageTimerUsagePct        float64                   `json:"averageTimerUsagePct"`
}

type dailyEfficiencyRaw struct {
	ScheduledTasks        int64
	CompletedTasks        int64
	TimerStarts           int
	ProductiveTimerStarts int
	AbandonedTimerStarts  int
	ShortTimerStarts      int
	TimerUsedMinutes      int
	TimerTimeTakenMinutes float64
}

const (
	focusSessionThresholdMinutes         = 20
	shortStartThresholdMinutes           = 8
	dailyMinutesBenchmark                = 180.0
	maxEfficiencyTrendDays               = 90
	weightTaskCompletion                 = 0.40
	weightFocusCompletion                = 0.35
	weightTimerUsage                     = 0.15
	weightTimerMinutes                   = 0.10
	abandonedStartPenaltyWeight          = 0.55
	shortStartPenaltyWeight              = 0.30
	abandonedStartCountPenaltyWeight     = 2.0
	shortStartCountPenaltyWeight         = 0.75
	abandonedCountPenaltyCap             = 24.0
	shortCountPenaltyCap                 = 10.0
)

func clampPct(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func pct(part float64, whole float64) float64 {
	if whole <= 0 {
		return 0
	}
	return clampPct((part / whole) * 100)
}

func round1(value float64) float64 {
	return math.Round(value*10) / 10
}

func normalizeDurationMinutes(duration int) int {
	if duration <= 0 {
		return 0
	}
	// Backward compatibility: older records may still hold seconds.
	if duration > 300 {
		return int(math.Round(float64(duration) / 60.0))
	}
	return duration
}

func dayStartInLocation(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)
	y, m, d := local.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, loc)
}

func collectDailyEfficiencyRaw(
	ctx context.Context,
	userID primitive.ObjectID,
	startDay time.Time,
	endDay time.Time,
	loc *time.Location,
) (map[string]*dailyEfficiencyRaw, error) {
	byDay := map[string]*dailyEfficiencyRaw{}
	for day := startDay; day.Before(endDay); day = day.Add(24 * time.Hour) {
		byDay[day.Format("2006-01-02")] = &dailyEfficiencyRaw{}
	}

	todosCollection := config.DB.Collection("todos")
	todoCursor, err := todosCollection.Find(ctx, bson.M{
		"userId": userID,
		"dueDate": bson.M{
			"$gte": startDay,
			"$lt":  endDay,
		},
	})
	if err != nil {
		return nil, err
	}
	defer todoCursor.Close(ctx)

	var todos []models.Todo
	if err := todoCursor.All(ctx, &todos); err != nil {
		return nil, err
	}

	for _, todo := range todos {
		if todo.DueDate == nil {
			continue
		}
		key := dayStartInLocation(*todo.DueDate, loc).Format("2006-01-02")
		raw, ok := byDay[key]
		if !ok {
			continue
		}

		raw.ScheduledTasks++
		if todo.Completed {
			raw.CompletedTasks++
		}
	}

	timerCollection := config.DB.Collection("timer_sessions")
	timerCursor, err := timerCollection.Find(ctx, bson.M{
		"userId": userID,
		"$or": []bson.M{
			{
				"startTime": bson.M{
					"$gte": startDay,
					"$lt":  endDay,
				},
			},
			{
				"createdAt": bson.M{
					"$gte": startDay,
					"$lt":  endDay,
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}
	defer timerCursor.Close(ctx)

	var sessions []models.Session
	if err := timerCursor.All(ctx, &sessions); err != nil {
		return nil, err
	}

	for _, session := range sessions {
		referenceTime := session.StartTime
		if referenceTime.IsZero() {
			referenceTime = session.CreatedAt
		}
		if referenceTime.IsZero() {
			continue
		}

		key := dayStartInLocation(referenceTime, loc).Format("2006-01-02")
		raw, ok := byDay[key]
		if !ok {
			continue
		}

		raw.TimerStarts++

		durationMinutes := normalizeDurationMinutes(session.Duration)
		if durationMinutes >= focusSessionThresholdMinutes {
			raw.ProductiveTimerStarts++
		} else {
			raw.AbandonedTimerStarts++
		}

		if durationMinutes <= shortStartThresholdMinutes {
			raw.ShortTimerStarts++
		}

		if durationMinutes > 0 {
			raw.TimerUsedMinutes += durationMinutes
		}

		sessionMinutes := 0.0
		if !session.StartTime.IsZero() && !session.EndTime.IsZero() && session.EndTime.After(session.StartTime) {
			sessionMinutes = session.EndTime.Sub(session.StartTime).Minutes()
		} else if durationMinutes > 0 {
			sessionMinutes = float64(durationMinutes)
		}

		if sessionMinutes > 0 {
			raw.TimerTimeTakenMinutes += sessionMinutes
		}
	}

	return byDay, nil
}

func buildDailyEfficiencyResponse(day time.Time, raw *dailyEfficiencyRaw) DailyEfficiencyResponse {
	taskCompletionPct := pct(float64(raw.CompletedTasks), float64(raw.ScheduledTasks))
	timerStartCompletionPct := pct(float64(raw.ProductiveTimerStarts), float64(raw.TimerStarts))
	timerUsagePct := pct(float64(raw.TimerUsedMinutes), raw.TimerTimeTakenMinutes)
	timerMinutesPct := clampPct((float64(raw.TimerUsedMinutes) / dailyMinutesBenchmark) * 100)
	abandonRatePct := pct(float64(raw.AbandonedTimerStarts), float64(raw.TimerStarts))
	shortStartRatePct := pct(float64(raw.ShortTimerStarts), float64(raw.TimerStarts))

	abandonedCountPenalty := math.Min(abandonedCountPenaltyCap, float64(raw.AbandonedTimerStarts)*abandonedStartCountPenaltyWeight)
	shortCountPenalty := math.Min(shortCountPenaltyCap, float64(raw.ShortTimerStarts)*shortStartCountPenaltyWeight)

	strictPenaltyPoints :=
		(abandonRatePct * abandonedStartPenaltyWeight) +
		(shortStartRatePct * shortStartPenaltyWeight) +
		abandonedCountPenalty +
		shortCountPenalty

	baseScore :=
		(taskCompletionPct * weightTaskCompletion) +
			(timerStartCompletionPct * weightFocusCompletion) +
			(timerUsagePct * weightTimerUsage) +
			(timerMinutesPct * weightTimerMinutes)

	overallEfficiencyPct := clampPct(baseScore - strictPenaltyPoints)

	return DailyEfficiencyResponse{
		Date:                    day.Format("2006-01-02"),
		ScheduledTasks:          raw.ScheduledTasks,
		CompletedTasks:          raw.CompletedTasks,
		TaskCompletionPct:       round1(taskCompletionPct),
		TimerStarts:             raw.TimerStarts,
		TimerCompletedSessions:  raw.ProductiveTimerStarts,
		ProductiveTimerStarts:   raw.ProductiveTimerStarts,
		AbandonedTimerStarts:    raw.AbandonedTimerStarts,
		ShortTimerStarts:        raw.ShortTimerStarts,
		TimerUsedMinutes:        raw.TimerUsedMinutes,
		TimerTimeTakenMinutes:   round1(raw.TimerTimeTakenMinutes),
		TimerStartCompletionPct: round1(timerStartCompletionPct),
		TimerUsagePct:           round1(timerUsagePct),
		TimerMinutesPct:         round1(timerMinutesPct),
		AbandonRatePct:          round1(abandonRatePct),
		ShortStartRatePct:       round1(shortStartRatePct),
		StrictPenaltyPoints:     round1(strictPenaltyPoints),
		FocusSessionThreshold:   focusSessionThresholdMinutes,
		DailyMinutesBenchmark:   int(dailyMinutesBenchmark),
		OverallEfficiencyPct:    round1(overallEfficiencyPct),
	}
}

func GetDailyEfficiency(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	days := 1
	if daysQuery := c.Query("days"); daysQuery != "" {
		if parsed, err := strconv.Atoi(daysQuery); err == nil && parsed > 0 {
			days = parsed
		}
	}
	if days > maxEfficiencyTrendDays {
		days = maxEfficiencyTrendDays
	}

	now := time.Now()
	loc := now.Location()
	startOfToday := dayStartInLocation(now, loc)
	rangeStart := startOfToday.AddDate(0, 0, -(days - 1))
	rangeEnd := startOfToday.Add(24 * time.Hour)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rawByDay, err := collectDailyEfficiencyRaw(ctx, user.ID, rangeStart, rangeEnd, loc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to calculate efficiency"})
	}

	if days == 1 {
		raw := rawByDay[startOfToday.Format("2006-01-02")]
		if raw == nil {
			raw = &dailyEfficiencyRaw{}
		}
		return c.JSON(buildDailyEfficiencyResponse(startOfToday, raw))
	}

	trend := make([]DailyEfficiencyResponse, 0, days)
	var overallSum float64
	var taskSum float64
	var timerUsageSum float64

	for i := 0; i < days; i++ {
		day := rangeStart.AddDate(0, 0, i)
		key := day.Format("2006-01-02")
		raw := rawByDay[key]
		if raw == nil {
			raw = &dailyEfficiencyRaw{}
		}

		daily := buildDailyEfficiencyResponse(day, raw)
		trend = append(trend, daily)
		overallSum += daily.OverallEfficiencyPct
		taskSum += daily.TaskCompletionPct
		timerUsageSum += daily.TimerUsagePct
	}

	divisor := float64(days)

	return c.JSON(EfficiencyTrendResponse{
		Days:                        days,
		Trend:                       trend,
		AverageOverallEfficiencyPct: round1(overallSum / divisor),
		AverageTaskCompletionPct:    round1(taskSum / divisor),
		AverageTimerUsagePct:        round1(timerUsageSum / divisor),
	})
}

func GetReports(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	collection := config.DB.Collection("daily_reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(30)
	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID}, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch reports"})
	}
	defer cursor.Close(ctx)

	var reports []Report
	if err = cursor.All(ctx, &reports); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse reports"})
	}

	if reports == nil {
		reports = []Report{}
	}

	return c.JSON(reports)
}

type CreateReportRequest struct {
	Date          string  `json:"date"`
	StudyHours    float64 `json:"studyHours"`
	HoursLogged   float64 `json:"hoursLogged"`
	PointsEarned  int     `json:"pointsEarned"`
	CompletionPct float64 `json:"completionPct"`
	Notes         string  `json:"notes"`
}

func CreateReport(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	reportDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		// Fallback to simple date parsing if RFC3339 fails (since JS Date string might differ based on frontend)
		reportDate, _ = time.Parse("2006-01-02", req.Date) 
	}

	newReport := Report{
		UserID:        user.ID,
		Date:          reportDate,
		StudyHours:    req.StudyHours,
		HoursLogged:   req.HoursLogged,
		PointsEarned:  req.PointsEarned,
		CompletionPct: req.CompletionPct,
		Notes:         req.Notes,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	collection := config.DB.Collection("daily_reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, newReport)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create report"})
	}

	newReport.ID = res.InsertedID.(primitive.ObjectID)

	return c.Status(fiber.StatusCreated).JSON(newReport)
}
