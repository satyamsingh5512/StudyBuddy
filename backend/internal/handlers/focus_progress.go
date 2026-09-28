package handlers

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
)

// Server-side counterparts of the on-device focus progress features.
//
// The Android widgets and progress notifications read local Room data, which is
// correct for a device that has never synced. These endpoints exist so the same
// figures follow the user across devices and are available before the first
// native sync, and so two clients cannot disagree about a streak or a goal.
//
// Design rules shared with the native side:
//
//   - A week is bounded at BOTH ends. An open-ended "from this date onward" query
//     would fold every later week into each earlier one and silently over-count.
//   - A week starts on the caller's first day of week, passed in as 0-6
//     (Sunday-Saturday), because the server cannot infer the device locale.
//   - The streak is read from the already-reconciled user document rather than
//     recomputed, so there is exactly one streak definition in the system.

const (
	defaultWeeklyRollupWeeks = 8
	maxWeeklyRollupWeeks     = 52
)

// focusMilestones mirrors the on-device milestone thresholds so a user sees the
// same milestones whether the figure came from the phone or the server.
var focusMilestones = []int{25, 50, 100, 180}

// WeeklyFocusRollup is one calendar week of focus totals.
type WeeklyFocusRollup struct {
	WeekStart    string  `json:"weekStart"`
	WeekEnd      string  `json:"weekEnd"`
	FocusMinutes int     `json:"focusMinutes"`
	StudyHours   float64 `json:"studyHours"`
	Sessions     int     `json:"sessions"`
	ActiveDays   int     `json:"activeDays"`
	DaysElapsed  int     `json:"daysElapsed"`
}

// FocusProgressResponse is the server's view of a user's focus progress.
type FocusProgressResponse struct {
	TodayFocusMinutes int      `json:"todayFocusMinutes"`
	DailyGoalMinutes  int      `json:"dailyGoalMinutes"`
	WeekFocusMinutes  int      `json:"weekFocusMinutes"`
	StreakDays        int      `json:"streakDays"`
	BestStreakDays    int      `json:"bestStreakDays"`
	GoalMet           bool     `json:"goalMet"`
	TodayDate         string   `json:"todayDate"`
	MilestonesHit     []string `json:"milestonesHit"`
}

// resolveRequestLocation reads the timezone query parameter, defaulting to the
// server's local zone. An unknown zone is ignored rather than rejected so a
// stale client cannot break the endpoint.
func resolveRequestLocation(c *fiber.Ctx) *time.Location {
	if tzName := strings.TrimSpace(c.Query("timezone")); tzName != "" {
		if tz, err := time.LoadLocation(tzName); err == nil {
			return tz
		}
	}
	return time.Now().Location()
}

// parseBoundedWeeks clamps the requested week count instead of rejecting it.
func parseBoundedWeeks(raw string) int {
	if raw == "" {
		return defaultWeeklyRollupWeeks
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 {
		return defaultWeeklyRollupWeeks
	}
	if parsed > maxWeeklyRollupWeeks {
		return maxWeeklyRollupWeeks
	}
	return parsed
}

// weekStartFor returns local midnight of the week containing t, where weeks begin
// on firstDay (time.Sunday through time.Saturday).
func weekStartFor(t time.Time, loc *time.Location, firstDay time.Weekday) time.Time {
	day := dayStartInLocation(t, loc)
	diff := (int(day.Weekday()) - int(firstDay) + 7) % 7
	return day.AddDate(0, 0, -diff)
}

// parseWeekday maps a 0-6 query value (Sunday-Saturday) to a time.Weekday.
func parseWeekday(raw string) time.Weekday {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed < 0 || parsed > 6 {
		return time.Monday
	}
	return time.Weekday(parsed)
}

// collectDailyFocusMinutes totals focus minutes per local date across a range
// that is bounded at both ends.
func collectDailyFocusMinutes(
	ctx context.Context,
	userID primitive.ObjectID,
	from time.Time,
	to time.Time,
	loc *time.Location,
) (map[string]int, error) {
	cursor, err := config.DB.Collection("timer_sessions").Find(ctx, bson.M{
		"userId": userID,
		"$or": bson.A{
			bson.M{"startTime": bson.M{"$gte": from, "$lt": to}},
			// Sessions created before startTime existed fall back to createdAt.
			bson.M{"startTime": bson.M{"$exists": false}, "createdAt": bson.M{"$gte": from, "$lt": to}},
		},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var sessions []models.Session
	if err := cursor.All(ctx, &sessions); err != nil {
		return nil, err
	}

	byDate := make(map[string]int, len(sessions))
	for _, session := range sessions {
		reference := session.StartTime
		if reference.IsZero() {
			reference = session.CreatedAt
		}
		if reference.IsZero() {
			continue
		}
		// Skip anything that lands outside the window even when it matched on the
		// fallback field, so a session is never counted into the wrong day.
		local := reference.In(loc)
		if local.Before(from) || !local.Before(to) {
			continue
		}
		minutes := normalizeDurationMinutes(session.Duration)
		if minutes <= 0 {
			continue
		}
		byDate[local.Format("2006-01-02")] += minutes
	}
	return byDate, nil
}

func sessionsInRange(
	ctx context.Context,
	userID primitive.ObjectID,
	from time.Time,
	to time.Time,
) (int, error) {
	count, err := config.DB.Collection("timer_sessions").CountDocuments(ctx, bson.M{
		"userId": userID,
		"$or": bson.A{
			bson.M{"startTime": bson.M{"$gte": from, "$lt": to}},
			bson.M{"startTime": bson.M{"$exists": false}, "createdAt": bson.M{"$gte": from, "$lt": to}},
		},
	})
	return int(count), err
}

// GetFocusGoal returns the user's own daily focus target.
func GetFocusGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	return c.JSON(fiber.Map{
		"dailyMinutes": user.FocusGoalMinutesOrDefault(),
		"min":          models.MinFocusGoalMinutes,
		"max":          models.MaxFocusGoalMinutes,
	})
}

// SetFocusGoal stores the daily focus target. Out-of-range values are clamped
// rather than rejected so a stale client cannot wedge the setting.
func SetFocusGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	body := struct {
		DailyMinutes *int `json:"dailyMinutes"`
	}{}
	if err := c.BodyParser(&body); err != nil || body.DailyMinutes == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "dailyMinutes is required"})
	}

	minutes := *body.DailyMinutes
	if minutes < models.MinFocusGoalMinutes {
		minutes = models.MinFocusGoalMinutes
	}
	if minutes > models.MaxFocusGoalMinutes {
		minutes = models.MaxFocusGoalMinutes
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"preferences.focusGoalMinutes": minutes, "updatedAt": time.Now().UTC()},
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save the focus goal"})
	}

	return c.JSON(fiber.Map{"dailyMinutes": minutes})
}

// GetWeeklyFocusRollups returns the trailing calendar weeks of focus totals,
// newest first. Each week is bounded on both ends.
func GetWeeklyFocusRollups(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	loc := resolveRequestLocation(c)
	firstDay := parseWeekday(c.Query("weekStart"))
	weeks := parseBoundedWeeks(c.Query("weeks"))

	now := time.Now()
	today := dayStartInLocation(now, loc)
	rangeStart := weekStartFor(now, loc, firstDay).AddDate(0, 0, -7*(weeks-1))
	rangeEnd := today.AddDate(0, 0, 1)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// The window is fetched once and then split per week, so overlapping weeks
	// cannot double-count and the query count stays constant as weeks grows.
	byDate, err := collectDailyFocusMinutes(ctx, user.ID, rangeStart, rangeEnd, loc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch weekly rollups"})
	}

	rollups := make([]WeeklyFocusRollup, 0, weeks)
	// Walk newest first so the response reads like the native widget.
	for offset := 0; offset < weeks; offset++ {
		start := today.AddDate(0, 0, -7*offset)
		start = weekStartFor(start, loc, firstDay)
		end := start.AddDate(0, 0, 7)

		minutes := 0
		activeDays := 0
		for i := 0; i < 7; i++ {
			day := start.AddDate(0, 0, i)
			if !day.Before(today) && !day.Equal(today) {
				break
			}
			key := day.Format("2006-01-02")
			if value := byDate[key]; value > 0 {
				minutes += value
				activeDays++
			}
		}

		// Only emit weeks that contain recorded focus, so a fresh account shows an
		// empty list rather than a row of zeroes that reads as a real measurement.
		if minutes == 0 {
			continue
		}

		sessions, _ := sessionsInRange(ctx, user.ID, start, end)
		rollups = append(rollups, WeeklyFocusRollup{
			WeekStart:    start.Format("2006-01-02"),
			WeekEnd:      end.AddDate(0, 0, -1).Format("2006-01-02"),
			FocusMinutes: minutes,
			StudyHours:   float64(minutes) / 60.0,
			Sessions:     sessions,
			ActiveDays:   activeDays,
			DaysElapsed:  daysElapsedInclusive(start, today),
		})
	}

	return c.JSON(fiber.Map{"weeks": rollups, "count": len(rollups)})
}

func daysElapsedInclusive(start, end time.Time) int {
	if end.Before(start) {
		return 0
	}
	return int(end.Sub(start).Hours()/24) + 1
}

// GetFocusProgress returns the streak, today's total, the weekly total, and
// whether the daily goal was actually met.
func GetFocusProgress(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	loc := resolveRequestLocation(c)
	firstDay := parseWeekday(c.Query("weekStart"))

	now := time.Now()
	today := dayStartInLocation(now, loc)
	rangeStart := weekStartFor(now, loc, firstDay)
	rangeEnd := today.AddDate(0, 0, 1)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Reading through reconcile keeps the streak the same value every other
	// endpoint reports, rather than a second definition that can drift.
	_, _ = reconcileUserStats(ctx, &user, loc, now)

	byDate, err := collectDailyFocusMinutes(ctx, user.ID, rangeStart, rangeEnd, loc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch focus progress"})
	}

	todayKey := today.Format("2006-01-02")
	todayMinutes := byDate[todayKey]
	weekMinutes := 0
	for _, value := range byDate {
		weekMinutes += value
	}

	goal := user.FocusGoalMinutesOrDefault()
	hits := make([]string, 0, len(focusMilestones))
	for _, mark := range focusMilestones {
		if todayMinutes >= mark && todayMinutes < mark+25 {
			hits = append(hits, strconv.Itoa(mark)+"m")
		}
	}

	return c.JSON(FocusProgressResponse{
		TodayFocusMinutes: todayMinutes,
		DailyGoalMinutes:  goal,
		WeekFocusMinutes:  weekMinutes,
		StreakDays:        user.Streak,
		BestStreakDays:    user.BestStreak,
		GoalMet:           goal > 0 && todayMinutes >= goal,
		TodayDate:         todayKey,
		MilestonesHit:     hits,
	})
}
