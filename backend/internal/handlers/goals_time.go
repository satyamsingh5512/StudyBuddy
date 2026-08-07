package handlers

import (
	"fmt"
	"strings"
	"time"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

var goalNow = func() time.Time { return time.Now().UTC() }

func loadGoalLocation(name string) (*time.Location, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, false
	}
	location, err := time.LoadLocation(name)
	if err != nil {
		return nil, false
	}
	return location, true
}

// goalRequestLocation applies one policy to every date-only goal endpoint:
// an IANA timezone supplied by the request wins, then the persisted profile
// timezone is used, and UTC is the safe fallback. Invalid request values do
// not make calendar operations depend on the API server's local timezone.
func goalRequestLocation(c *fiber.Ctx, user models.User) *time.Location {
	for _, candidate := range []string{c.Query("timezone"), c.Get("X-Timezone"), user.Timezone} {
		if location, ok := loadGoalLocation(candidate); ok {
			return location
		}
	}
	return time.UTC
}

func parseDateOnlyInLocation(value string, location *time.Location) (time.Time, error) {
	if location == nil {
		location = time.UTC
	}
	if len(value) != len(goalDateLayout) {
		return time.Time{}, fmt.Errorf("must use YYYY-MM-DD")
	}
	parsed, err := time.ParseInLocation(goalDateLayout, value, location)
	if err != nil || parsed.Format(goalDateLayout) != value {
		return time.Time{}, fmt.Errorf("must use YYYY-MM-DD")
	}
	return parsed, nil
}

func localGoalDay(now time.Time, location *time.Location) time.Time {
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func mondayOnOrBefore(day time.Time) time.Time {
	offset := (int(day.Weekday()) - int(time.Monday) + 7) % 7
	return day.AddDate(0, 0, -offset)
}

func parseGoalRangeInLocation(from, to string, location *time.Location) (time.Time, time.Time, error) {
	if from == "" || to == "" {
		return time.Time{}, time.Time{}, fmt.Errorf("from and to are required")
	}
	start, err := parseDateOnlyInLocation(from, location)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid from date")
	}
	end, err := parseDateOnlyInLocation(to, location)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid to date")
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("to must not be before from")
	}
	// AddDate counts calendar days correctly even across DST boundaries.
	if end.After(start.AddDate(0, 0, maxGoalRangeDays-1)) {
		return time.Time{}, time.Time{}, fmt.Errorf("date range cannot exceed %d days", maxGoalRangeDays)
	}
	return start, end, nil
}
