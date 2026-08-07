package handlers

import (
	"testing"
	"time"

	"studybuddy-backend/internal/models"
)

func mustGoalDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := parseDateOnly(value)
	if err != nil {
		t.Fatalf("invalid test date %q: %v", value, err)
	}
	return parsed
}

func TestCalculateGoalStatsDaily(t *testing.T) {
	goal := validTestGoal()
	goal.StartDate = "2026-08-03"
	showUps := []models.ShowUp{
		{Date: "2026-08-03", Status: models.GoalActivityComplete},
		{Date: "2026-08-04", Status: models.GoalActivityPartial},
		{Date: "2026-08-06", Status: models.GoalActivityComplete},
		{Date: "2026-08-07", Status: models.GoalActivityPartial},
	}
	checkIns := []models.GoalCheckIn{{WeekStart: "2026-08-03", TargetMomentum: 70}}
	stats := calculateGoalStats(goal, showUps, checkIns, mustGoalDate(t, "2026-08-03"), mustGoalDate(t, "2026-08-07"), mustGoalDate(t, "2026-08-07"), time.UTC)
	if stats.Momentum != 60 || stats.BestStreak != 2 || stats.CurrentStreak != 2 {
		t.Fatalf("unexpected daily stats: %#v", stats)
	}
	if stats.ShowUps.Complete != 2 || stats.ShowUps.Partial != 2 || stats.ShowUps.Total != 4 {
		t.Fatalf("unexpected show-up summary: %#v", stats.ShowUps)
	}
	if stats.TargetMomentum == nil || *stats.TargetMomentum != 70 || stats.MomentumDelta == nil || *stats.MomentumDelta != -10 {
		t.Fatalf("unexpected target comparison: %#v", stats)
	}
	// Monday is index 0 and has one complete eligible entry.
	if stats.WeekdayPattern[0].Weekday != "Monday" || stats.WeekdayPattern[0].CompletionRate != 100 {
		t.Fatalf("unexpected weekday pattern: %#v", stats.WeekdayPattern)
	}
}

func TestCalculateGoalStatsWeekly(t *testing.T) {
	goal := validTestGoal()
	goal.GridMode = models.GoalGridWeekly
	goal.StartDate = "2026-07-06"
	showUps := []models.ShowUp{
		{Date: "2026-07-06", Status: models.GoalActivityComplete},
		{Date: "2026-07-13", Status: models.GoalActivityPartial},
		{Date: "2026-07-27", Status: models.GoalActivityComplete},
		{Date: "2026-08-03", Status: models.GoalActivityComplete},
	}
	stats := calculateGoalStats(goal, showUps, nil, mustGoalDate(t, "2026-07-06"), mustGoalDate(t, "2026-08-07"), mustGoalDate(t, "2026-08-07"), time.UTC)
	if stats.Momentum != 70 || stats.BestStreak != 2 || stats.CurrentStreak != 2 {
		t.Fatalf("unexpected weekly stats: %#v", stats)
	}
	if stats.WeekdayPattern[0].Eligible != 5 || stats.WeekdayPattern[0].Completed != 3 || stats.WeekdayPattern[0].Partial != 1 {
		t.Fatalf("unexpected weekly pattern: %#v", stats.WeekdayPattern)
	}
}

func TestCalculateGoalStatsClipsTimelineAndFuture(t *testing.T) {
	target := "2026-08-05"
	goal := validTestGoal()
	goal.StartDate = "2026-08-03"
	goal.TargetDate = &target
	showUps := []models.ShowUp{
		{Date: "2026-08-02", Status: models.GoalActivityComplete},
		{Date: "2026-08-03", Status: models.GoalActivityComplete},
		{Date: "2026-08-06", Status: models.GoalActivityComplete},
	}
	stats := calculateGoalStats(goal, showUps, nil, mustGoalDate(t, "2026-08-01"), mustGoalDate(t, "2026-08-10"), mustGoalDate(t, "2026-08-07"), time.UTC)
	if stats.Momentum != 33.3 || stats.ShowUps.Total != 1 {
		t.Fatalf("timeline was not clipped: %#v", stats)
	}
}

func TestCalculateGoalStatsEmptyEligibility(t *testing.T) {
	goal := validTestGoal()
	goal.StartDate = "2026-09-01"
	stats := calculateGoalStats(goal, nil, nil, mustGoalDate(t, "2026-08-01"), mustGoalDate(t, "2026-08-07"), mustGoalDate(t, "2026-08-07"), time.UTC)
	if stats.Momentum != 0 || stats.CurrentStreak != 0 || stats.BestStreak != 0 || len(stats.WeekdayPattern) != 7 {
		t.Fatalf("unexpected empty stats: %#v", stats)
	}
}

func TestCurrentDailyStreakIgnoresOpenCurrentDay(t *testing.T) {
	goal := validTestGoal()
	goal.StartDate = "2026-08-03"
	showUps := []models.ShowUp{
		{Date: "2026-08-03", Status: models.GoalActivityComplete},
		{Date: "2026-08-04", Status: models.GoalActivityComplete},
		{Date: "2026-08-05", Status: models.GoalActivityPartial},
		{Date: "2026-08-06", Status: models.GoalActivityComplete},
	}
	stats := calculateGoalStats(goal, showUps, nil, mustGoalDate(t, "2026-08-03"), mustGoalDate(t, "2026-08-07"), time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC), time.UTC)
	if stats.CurrentStreak != 4 {
		t.Fatalf("open current day broke streak: %#v", stats)
	}
}

func TestCurrentWeeklyStreakIgnoresOpenCurrentWeek(t *testing.T) {
	goal := validTestGoal()
	goal.GridMode = models.GoalGridWeekly
	goal.StartDate = "2026-07-20"
	showUps := []models.ShowUp{
		{Date: "2026-07-20", Status: models.GoalActivityComplete},
		{Date: "2026-07-27", Status: models.GoalActivityPartial},
	}
	stats := calculateGoalStats(goal, showUps, nil, mustGoalDate(t, "2026-07-20"), mustGoalDate(t, "2026-08-05"), time.Date(2026, 8, 5, 12, 0, 0, 0, time.UTC), time.UTC)
	if stats.CurrentStreak != 2 {
		t.Fatalf("open current week broke streak: %#v", stats)
	}
}

func TestCheckInMondayOverlappingMidweekRangeIsIncluded(t *testing.T) {
	goal := validTestGoal()
	goal.StartDate = "2026-08-01"
	checkIns := []models.GoalCheckIn{{WeekStart: "2026-08-03", TargetMomentum: 80}}
	stats := calculateGoalStats(goal, nil, checkIns, mustGoalDate(t, "2026-08-05"), mustGoalDate(t, "2026-08-07"), time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC), time.UTC)
	if stats.TargetMomentum == nil || *stats.TargetMomentum != 80 {
		t.Fatalf("overlapping Monday check-in omitted: %#v", stats)
	}
}

func TestStatsClipToAsiaKolkataCurrentDay(t *testing.T) {
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	goal := validTestGoal()
	goal.StartDate = "2026-08-07"
	from, _ := parseDateOnlyInLocation("2026-08-07", location)
	showUps := []models.ShowUp{{Date: "2026-08-07", Status: models.GoalActivityComplete}}
	// UTC is still 6 August while the user's local date is 7 August.
	stats := calculateGoalStats(goal, showUps, nil, from, from, time.Date(2026, 8, 6, 19, 0, 0, 0, time.UTC), location)
	if stats.Momentum != 100 || stats.ShowUps.Total != 1 {
		t.Fatalf("stats used UTC rather than local date clipping: %#v", stats)
	}
}

func TestCalculateGoalStatsFiltersStaleAutomaticAndKeepsManual(t *testing.T) {
	goal := validTestGoal()
	goal.StartDate = "2026-08-06"
	showUps := []models.ShowUp{
		{Date: "2026-08-06", Status: models.GoalActivityComplete, Source: models.GoalSourceAutomatic, DefinitionVersion: goal.DefinitionVersion - 1},
		{Date: "2026-08-07", Status: models.GoalActivityPartial, Source: models.GoalSourceManual},
	}
	stats := calculateGoalStats(goal, showUps, nil, mustGoalDate(t, "2026-08-06"), mustGoalDate(t, "2026-08-07"), mustGoalDate(t, "2026-08-07"), time.UTC)
	if stats.ShowUps.Total != 1 || stats.ShowUps.Complete != 0 || stats.ShowUps.Partial != 1 || stats.Momentum != 25 {
		t.Fatalf("stale automatic row affected stats or manual row was lost: %#v", stats)
	}
}
