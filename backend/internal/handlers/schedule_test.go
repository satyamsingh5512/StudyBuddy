package handlers

import (
	"testing"

	"studybuddy-backend/internal/models"
)

func TestParseClockMinutes(t *testing.T) {
	cases := map[string]struct {
		want int
		ok   bool
	}{
		"09:30":    {570, true},
		"9:30":     {570, true},
		"21:00":    {1260, true},
		"9:30 PM":  {1290, true},
		"12:00 AM": {0, true},
		"12:15 PM": {735, true},
		"7 pm":     {1140, true},
		"":         {0, false},
		"noon":     {0, false},
		"25:00":    {0, false},
		"10:75":    {0, false},
	}

	for input, expected := range cases {
		got, ok := parseClockMinutes(input)
		if ok != expected.ok || (ok && got != expected.want) {
			t.Errorf("parseClockMinutes(%q) = (%d, %v), want (%d, %v)", input, got, ok, expected.want, expected.ok)
		}
	}
}

func TestCeilToQuarterHour(t *testing.T) {
	cases := map[int]int{
		0:   0,
		1:   15,
		821: 825, // 13:41 → 13:45
		825: 825,
		826: 840,
	}
	for input, want := range cases {
		if got := ceilToQuarterHour(input); got != want {
			t.Errorf("ceilToQuarterHour(%d) = %d, want %d", input, got, want)
		}
	}
}

func TestNormalizeScheduleItemsDropsAndTrimsPastBlocks(t *testing.T) {
	// Cutoff at 13:45.
	items := []models.ScheduleItem{
		{TaskTitle: "finished", StartTime: "08:00", EndTime: "09:00"},
		{TaskTitle: "straddling", StartTime: "13:00", EndTime: "15:00"},
		{TaskTitle: "later", StartTime: "4:00 PM", EndTime: "5:30 PM"},
		{TaskTitle: "unparseable", StartTime: "later", EndTime: "18:00"},
		{TaskTitle: "inverted", StartTime: "20:00", EndTime: "19:00"},
	}

	got := normalizeScheduleItems(items, 13*60+45)

	if len(got) != 2 {
		t.Fatalf("kept %d items, want 2: %+v", len(got), got)
	}
	if got[0].TaskTitle != "straddling" || got[0].StartTime != "13:45" || got[0].EndTime != "15:00" {
		t.Errorf("first item = %+v, want straddling trimmed to 13:45-15:00", got[0])
	}
	if got[1].TaskTitle != "later" || got[1].StartTime != "16:00" || got[1].EndTime != "17:30" {
		t.Errorf("second item = %+v, want later normalized to 16:00-17:30", got[1])
	}
}

func TestNormalizeScheduleItemsKeepsFullDayWhenCutoffDisabled(t *testing.T) {
	items := []models.ScheduleItem{
		{TaskTitle: "evening", StartTime: "19:00", EndTime: "20:00"},
		{TaskTitle: "morning", StartTime: "06:00", EndTime: "07:00"},
	}

	got := normalizeScheduleItems(items, -1)

	if len(got) != 2 {
		t.Fatalf("kept %d items, want 2", len(got))
	}
	if got[0].TaskTitle != "morning" || got[1].TaskTitle != "evening" {
		t.Errorf("items not sorted by start time: %+v", got)
	}
}

func TestScheduleLocationFallsBackToServerClock(t *testing.T) {
	if loc := scheduleLocation("Asia/Kolkata"); loc.String() != "Asia/Kolkata" {
		t.Errorf("scheduleLocation(\"Asia/Kolkata\") = %q", loc.String())
	}
	if loc := scheduleLocation("Not/AZone"); loc == nil {
		t.Error("scheduleLocation with unknown zone returned nil")
	}
	if loc := scheduleLocation(""); loc == nil {
		t.Error("scheduleLocation with empty zone returned nil")
	}
}
