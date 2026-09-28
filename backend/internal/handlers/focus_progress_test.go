package handlers

import (
	"testing"
	"time"

	"studybuddy-backend/internal/models"
)

func TestWeekStartForUsesTheRequestedFirstDay(t *testing.T) {
	// 2026-01-07 is a Wednesday.
	wednesday := time.Date(2026, time.January, 7, 13, 45, 0, 0, time.UTC)
	loc := time.UTC

	cases := []struct {
		name      string
		firstDay  time.Weekday
		wantStart string
	}{
		{"monday start", time.Monday, "2026-01-05"},
		{"sunday start", time.Sunday, "2026-01-04"},
		{"wednesday start is the same day", time.Wednesday, "2026-01-07"},
		{"saturday start", time.Saturday, "2026-01-03"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := weekStartFor(wednesday, loc, tc.firstDay)
			if got.Format("2006-01-02") != tc.wantStart {
				t.Fatalf("weekStartFor = %s, want %s", got.Format("2006-01-02"), tc.wantStart)
			}
			if got.Weekday() != tc.firstDay {
				t.Fatalf("result weekday = %s, want %s", got.Weekday(), tc.firstDay)
			}
			// The result must be local midnight, never a time-of-day component.
			if got.Hour() != 0 || got.Minute() != 0 || got.Second() != 0 {
				t.Fatalf("weekStartFor must return midnight, got %s", got)
			}
		})
	}
}

// A week start must always be a non-positive offset from its own day, otherwise
// a "weeks" window would walk forward and skip history.
func TestWeekStartForNeverMovesForward(t *testing.T) {
	loc := time.UTC
	for day := 0; day < 14; day++ {
		someDay := time.Date(2026, time.March, 1, 22, 0, 0, 0, loc).AddDate(0, 0, day)
		for _, first := range []time.Weekday{time.Sunday, time.Monday, time.Saturday} {
			got := weekStartFor(someDay, loc, first)
			if got.After(someDay) {
				t.Fatalf("weekStartFor(%s, %s) = %s is in the future", someDay.Weekday(), first, got)
			}
		}
	}
}

func TestParseBoundedWeeks(t *testing.T) {
	cases := []struct {
		raw  string
		want int
	}{
		{"", defaultWeeklyRollupWeeks},
		{"1", 1},
		{"12", 12},
		{"0", defaultWeeklyRollupWeeks},
		{"-5", defaultWeeklyRollupWeeks},
		{"abc", defaultWeeklyRollupWeeks},
		{"999", maxWeeklyRollupWeeks},
		{"52", maxWeeklyRollupWeeks},
	}
	for _, tc := range cases {
		if got := parseBoundedWeeks(tc.raw); got != tc.want {
			t.Errorf("parseBoundedWeeks(%q) = %d, want %d", tc.raw, got, tc.want)
		}
	}
}

func TestParseWeekdayDefaultsToMonday(t *testing.T) {
	cases := []struct {
		raw  string
		want time.Weekday
	}{
		{"0", time.Sunday},
		{"6", time.Saturday},
		{"", time.Monday},
		{"7", time.Monday},
		{"-1", time.Monday},
		{"nope", time.Monday},
	}
	for _, tc := range cases {
		if got := parseWeekday(tc.raw); got != tc.want {
			t.Errorf("parseWeekday(%q) = %s, want %s", tc.raw, got, tc.want)
		}
	}
}

func TestFocusGoalBounds(t *testing.T) {
	// A stored value outside the bounds must fall back to the default rather than
	// being reported verbatim, so a hand-edited document cannot imply an
	// impossible goal.
	cases := []struct {
		stored int
		want   int
	}{
		{0, models.DefaultFocusGoalMinutes},
		{-30, models.DefaultFocusGoalMinutes},
		{100000, models.DefaultFocusGoalMinutes},
		{60, 60},
		{models.MinFocusGoalMinutes, models.MinFocusGoalMinutes},
		{models.MaxFocusGoalMinutes, models.MaxFocusGoalMinutes},
	}
	for _, tc := range cases {
		user := models.User{
			Preferences: models.UserPreferences{FocusGoalMinutes: tc.stored},
		}
		if got := user.FocusGoalMinutesOrDefault(); got != tc.want {
			t.Errorf("goal %d -> %d, want %d", tc.stored, got, tc.want)
		}
	}
}

// NormalizeUserPreferences must repair an out-of-range stored goal, because that
// is the path used when a user document is read into a handler.
func TestNormalizeRepairsOutOfRangeFocusGoal(t *testing.T) {
	user := models.User{}
	models.NormalizeUserPreferences(&user)
	if user.Preferences.FocusGoalMinutes != models.DefaultFocusGoalMinutes {
		t.Fatalf("empty preferences goal = %d, want %d",
			user.Preferences.FocusGoalMinutes, models.DefaultFocusGoalMinutes)
	}

	user.Preferences.FocusGoalMinutes = 99999
	models.NormalizeUserPreferences(&user)
	if user.Preferences.FocusGoalMinutes != models.DefaultFocusGoalMinutes {
		t.Fatalf("oversized goal = %d, want %d",
			user.Preferences.FocusGoalMinutes, models.DefaultFocusGoalMinutes)
	}

	user.Preferences.FocusGoalMinutes = 45
	models.NormalizeUserPreferences(&user)
	if user.Preferences.FocusGoalMinutes != 45 {
		t.Fatalf("in-range goal was overwritten: got %d, want 45", user.Preferences.FocusGoalMinutes)
	}
}

func TestDaysElapsedInclusive(t *testing.T) {
	loc := time.UTC
	start := time.Date(2026, time.May, 4, 0, 0, 0, 0, loc)
	sameDay := time.Date(2026, time.May, 4, 23, 0, 0, 0, loc)
	threeDays := time.Date(2026, time.May, 7, 0, 0, 0, 0, loc)
	before := time.Date(2026, time.May, 3, 0, 0, 0, 0, loc)

	if got := daysElapsedInclusive(start, sameDay); got != 1 {
		t.Errorf("same day = %d, want 1", got)
	}
	if got := daysElapsedInclusive(start, threeDays); got != 4 {
		t.Errorf("inclusive span = %d, want 4", got)
	}
	if got := daysElapsedInclusive(start, before); got != 0 {
		t.Errorf("end before start = %d, want 0", got)
	}
}
