package handlers

import (
	"net/http/httptest"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func validTestGoal() models.Goal {
	return models.Goal{
		ID:                primitive.NewObjectID(),
		UserID:            primitive.NewObjectID(),
		DefinitionVersion: 1,
		Title:             "Finish the physics syllabus",
		Status:            models.GoalStatusActive,
		GridMode:          models.GoalGridDaily,
		CompletionPolicy:  models.GoalCompletionAuto,
		StartDate:         "2026-08-01",
		SubGoals: []models.SubGoal{{
			ID: primitive.NewObjectID(), Title: "Mechanics", Position: 0,
		}},
		Milestones: []models.Milestone{},
	}
}

func TestParseGoalRange(t *testing.T) {
	tests := []struct {
		name    string
		from    string
		to      string
		wantErr bool
	}{
		{name: "one day", from: "2026-08-07", to: "2026-08-07"},
		{name: "maximum leap-spanning range", from: "2024-01-01", to: "2024-12-31"},
		{name: "missing", from: "", to: "2026-08-07", wantErr: true},
		{name: "invalid calendar day", from: "2026-02-29", to: "2026-03-01", wantErr: true},
		{name: "noncanonical", from: "2026-8-01", to: "2026-08-02", wantErr: true},
		{name: "reversed", from: "2026-08-08", to: "2026-08-07", wantErr: true},
		{name: "too long", from: "2025-01-01", to: "2026-01-02", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, _, err := parseGoalRange(test.from, test.to)
			if (err != nil) != test.wantErr {
				t.Fatalf("parseGoalRange() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestValidateGoal(t *testing.T) {
	targetBefore := "2026-07-31"
	milestoneAfter := "2026-09-01"
	target := "2026-08-31"
	tests := []struct {
		name   string
		mutate func(*models.Goal)
	}{
		{name: "invalid grid", mutate: func(g *models.Goal) { g.GridMode = "monthly" }},
		{name: "invalid policy", mutate: func(g *models.Goal) { g.CompletionPolicy = "sometimes" }},
		{name: "auto without sub-goals", mutate: func(g *models.Goal) { g.SubGoals = nil }},
		{name: "target before start", mutate: func(g *models.Goal) { g.TargetDate = &targetBefore }},
		{name: "duplicate sub-goal IDs", mutate: func(g *models.Goal) { g.SubGoals = append(g.SubGoals, g.SubGoals[0]) }},
		{name: "milestone outside timeline", mutate: func(g *models.Goal) {
			g.TargetDate = &target
			g.Milestones = []models.Milestone{{ID: primitive.NewObjectID(), Title: "Mock test", TargetDate: &milestoneAfter}}
		}},
	}
	goal := validTestGoal()
	if err := validateGoal(&goal); err != nil {
		t.Fatalf("valid goal rejected: %v", err)
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			goal := validTestGoal()
			test.mutate(&goal)
			if err := validateGoal(&goal); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestBuildSubGoalsNormalizesOrderAndRejectsDuplicateIDs(t *testing.T) {
	now := time.Date(2026, 8, 7, 0, 0, 0, 0, time.UTC)
	id := primitive.NewObjectID()
	items, err := buildSubGoals([]subGoalInput{{ID: id.Hex(), Title: " First "}, {Title: "Second"}}, now)
	if err != nil {
		t.Fatalf("buildSubGoals() error = %v", err)
	}
	if items[0].Title != "First" || items[0].Position != 0 || items[1].Position != 1 || items[1].ID.IsZero() {
		t.Fatalf("items were not normalized: %#v", items)
	}
	_, err = buildSubGoals([]subGoalInput{{ID: id.Hex(), Title: "First"}, {ID: id.Hex(), Title: "Again"}}, now)
	if err == nil {
		t.Fatal("expected duplicate ID error")
	}
}

func TestReorderObjectIDs(t *testing.T) {
	first, second := primitive.NewObjectID(), primitive.NewObjectID()
	positions, err := reorderObjectIDs([]string{second.Hex(), first.Hex()}, []primitive.ObjectID{first, second})
	if err != nil {
		t.Fatalf("reorderObjectIDs() error = %v", err)
	}
	if positions[second] != 0 || positions[first] != 1 {
		t.Fatalf("unexpected positions: %#v", positions)
	}
	if _, err := reorderObjectIDs([]string{first.Hex(), first.Hex()}, []primitive.ObjectID{first, second}); err == nil {
		t.Fatal("expected duplicate/unknown reorder error")
	}
}

func TestApplyAutoCompletionAndReopen(t *testing.T) {
	now := time.Date(2026, 8, 7, 0, 0, 0, 0, time.UTC)
	goal := validTestGoal()
	goal.SubGoals[0].Completed = true
	goal.Milestones = []models.Milestone{{ID: primitive.NewObjectID(), Title: "Checkpoint", Completed: true}}
	applyAutoCompletion(&goal, now)
	if goal.Status != models.GoalStatusCompleted || goal.CompletedAt == nil {
		t.Fatalf("goal was not auto-completed: %#v", goal)
	}
	goal.SubGoals[0].Completed = false
	applyAutoCompletion(&goal, now.Add(time.Hour))
	if goal.Status != models.GoalStatusActive || goal.CompletedAt != nil {
		t.Fatalf("goal was not reopened after incomplete definition: %#v", goal)
	}
	goal.CompletionPolicy = models.GoalCompletionManual
	goal.Status = models.GoalStatusActive
	goal.SubGoals[0].Completed = true
	applyAutoCompletion(&goal, now)
	if goal.Status != models.GoalStatusActive {
		t.Fatal("manual goal should not auto-complete")
	}
}

func TestOwnedFiltersAlwaysContainUser(t *testing.T) {
	userID, goalID := primitive.NewObjectID(), primitive.NewObjectID()
	filter := goalOwnedFilter(goalID, userID)
	if filter["_id"] != goalID || filter["userId"] != userID || len(filter) != 2 {
		t.Fatalf("unsafe owned filter: %#v", filter)
	}
	activity := goalActivityFilter(userID, goalID, "date", "2026-08-07")
	if activity["userId"] != userID || activity["goalId"] != goalID || activity["date"] != "2026-08-07" {
		t.Fatalf("unsafe activity filter: %#v", activity)
	}
	goal := validTestGoal()
	goal.ID, goal.UserID = goalID, userID
	automatic := automaticShowUpFilter(goal, "2026-08-07")
	source, ok := automatic["source"].(primitive.M)
	if !ok || source["$ne"] != models.GoalSourceManual || automatic["$or"] == nil {
		t.Fatalf("automatic filter can overwrite manual/newer records: %#v", automatic)
	}
}

func TestValidateWeeklyActivity(t *testing.T) {
	goal := validTestGoal()
	goal.GridMode = models.GoalGridWeekly
	if err := validateActivityWrite(goal, "2026-08-03", time.UTC, time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("Monday rejected: %v", err)
	}
	if err := validateActivityWrite(goal, "2026-08-04", time.UTC, time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("non-Monday weekly activity accepted")
	}
	goal.Status = models.GoalStatusArchived
	if err := validateActivityWrite(goal, "2026-08-03", time.UTC, time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("archived goal activity accepted")
	}
}

func TestValidateActivityRejectsFutureDate(t *testing.T) {
	goal := validTestGoal()
	now := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	if err := validateActivityWrite(goal, "2026-08-08", time.UTC, now); err == nil {
		t.Fatal("future activity date accepted")
	}
}

func TestGoalTransitionCompletionPolicyAndRestore(t *testing.T) {
	now := time.Date(2026, 8, 7, 1, 0, 0, 0, time.UTC)
	auto := validTestGoal()
	if err := applyGoalTransition(&auto, models.GoalStatusCompleted, now); err == nil {
		t.Fatal("auto-policy goal accepted manual completion")
	}
	if auto.Status != models.GoalStatusActive || auto.CompletedAt != nil {
		t.Fatalf("rejected transition mutated goal: %#v", auto)
	}

	auto.Status = models.GoalStatusArchived
	auto.ArchivedAt = &now
	auto.SubGoals[0].Completed = true
	if err := applyGoalTransition(&auto, models.GoalStatusActive, now.Add(time.Hour)); err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if auto.Status != models.GoalStatusCompleted || auto.CompletedAt == nil || auto.ArchivedAt != nil {
		t.Fatalf("restored auto goal did not derive completion state: %#v", auto)
	}

	manual := validTestGoal()
	manual.CompletionPolicy = models.GoalCompletionManual
	if err := applyGoalTransition(&manual, models.GoalStatusCompleted, now); err != nil {
		t.Fatalf("manual-policy completion rejected: %v", err)
	}
	if manual.Status != models.GoalStatusCompleted || manual.CompletedAt == nil {
		t.Fatalf("manual completion was not applied: %#v", manual)
	}
}

func TestAutomaticShowUpStatePreservesManualPrecedence(t *testing.T) {
	goal := validTestGoal()
	manual := &models.ShowUp{Source: models.GoalSourceManual, Status: models.GoalActivityPartial}
	status, write, preserve := automaticShowUpState(goal, manual, []models.GoalCompletion{{
		SubGoalID: goal.SubGoals[0].ID, DefinitionVersion: goal.DefinitionVersion, Status: models.GoalActivityComplete,
	}})
	if status != "" || write || !preserve {
		t.Fatalf("manual show-up was not preserved: status=%q write=%v preserve=%v", status, write, preserve)
	}
}

func TestAutomaticShowUpStateRequiresEveryCurrentSubGoal(t *testing.T) {
	goal := validTestGoal()
	goal.SubGoals = append(goal.SubGoals, models.SubGoal{ID: primitive.NewObjectID(), Title: "Second"})
	completion := func(subGoalID primitive.ObjectID) models.GoalCompletion {
		return models.GoalCompletion{
			SubGoalID: subGoalID, DefinitionVersion: goal.DefinitionVersion, Status: models.GoalActivityComplete,
		}
	}

	tests := []struct {
		name       string
		entries    []models.GoalCompletion
		wantStatus string
		wantWrite  bool
	}{
		{name: "zero of N", entries: nil, wantWrite: false},
		{name: "zero of N with partial entry", entries: []models.GoalCompletion{{SubGoalID: goal.SubGoals[0].ID, DefinitionVersion: goal.DefinitionVersion, Status: models.GoalActivityPartial}}, wantWrite: false},
		{name: "one of N", entries: []models.GoalCompletion{completion(goal.SubGoals[0].ID)}, wantStatus: models.GoalActivityPartial, wantWrite: true},
		{name: "N of N", entries: []models.GoalCompletion{completion(goal.SubGoals[0].ID), completion(goal.SubGoals[1].ID)}, wantStatus: models.GoalActivityComplete, wantWrite: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			status, write, preserve := automaticShowUpState(goal, nil, test.entries)
			if status != test.wantStatus || write != test.wantWrite || preserve {
				t.Fatalf("status=%q write=%v preserve=%v, want status=%q write=%v", status, write, preserve, test.wantStatus, test.wantWrite)
			}
		})
	}
}

func TestAutomaticShowUpStateIgnoresStaleAndUnknownCompletions(t *testing.T) {
	goal := validTestGoal()
	entries := []models.GoalCompletion{
		{SubGoalID: goal.SubGoals[0].ID, DefinitionVersion: goal.DefinitionVersion - 1, Status: models.GoalActivityComplete},
		{SubGoalID: primitive.NewObjectID(), DefinitionVersion: goal.DefinitionVersion, Status: models.GoalActivityComplete},
	}
	status, write, preserve := automaticShowUpState(goal, nil, entries)
	if status != "" || write || preserve {
		t.Fatalf("stale or unknown completions produced a show-up: status=%q write=%v preserve=%v", status, write, preserve)
	}
}

func TestValidateActivityUsesAsiaKolkataCalendarDay(t *testing.T) {
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	goal := validTestGoal()
	// 6 August in UTC, but already 7 August in Asia/Kolkata.
	now := time.Date(2026, 8, 6, 19, 0, 0, 0, time.UTC)
	if err := validateActivityWrite(goal, "2026-08-07", location, now); err != nil {
		t.Fatalf("local current date rejected around midnight: %v", err)
	}
	if err := validateActivityWrite(goal, "2026-08-08", location, now); err == nil {
		t.Fatal("local future date accepted around midnight")
	}
}

func TestCheckInRangeFilterIncludesOverlappingMonday(t *testing.T) {
	userID, goalID := primitive.NewObjectID(), primitive.NewObjectID()
	var filter primitive.M
	var filterErr error
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		c.Locals("user", models.User{ID: userID, Timezone: "Asia/Kolkata"})
		filter, filterErr = rangeFilterForGoal(c, goalID, userID, "weekStart")
		return c.SendStatus(fiber.StatusNoContent)
	})
	request := httptest.NewRequest("GET", "/?from=2026-08-05&to=2026-08-07", nil)
	response, err := app.Test(request)
	if err != nil || response.StatusCode != fiber.StatusNoContent || filterErr != nil {
		t.Fatalf("range filter request failed: response=%v err=%v filterErr=%v", response, err, filterErr)
	}
	rangeQuery, ok := filter["weekStart"].(primitive.M)
	if !ok || rangeQuery["$gte"] != "2026-08-03" || rangeQuery["$lte"] != "2026-08-07" {
		t.Fatalf("overlapping Monday was not queried: %#v", filter)
	}
	if filter["userId"] != userID || filter["goalId"] != goalID {
		t.Fatalf("check-in range filter was not owner-scoped: %#v", filter)
	}
}

func TestDefinitionVersionAdvancesAndFencesCompletionFilters(t *testing.T) {
	goal := validTestGoal()
	original := goal.DefinitionVersion
	incrementDefinitionVersion(&goal)
	if goal.DefinitionVersion != original+1 {
		t.Fatalf("definition version = %d, want %d", goal.DefinitionVersion, original+1)
	}
	filter := currentCompletionFilter(goal)
	if filter["definitionVersion"] != goal.DefinitionVersion || filter["userId"] != goal.UserID || filter["goalId"] != goal.ID {
		t.Fatalf("completion filter is not generation/owner scoped: %#v", filter)
	}
	subGoals, ok := filter["subGoalId"].(primitive.M)
	if !ok || subGoals["$in"] == nil {
		t.Fatalf("completion filter does not require a valid sub-goal: %#v", filter)
	}
}

func TestGoalActivityCurrentFilterIncludesLifecycleFence(t *testing.T) {
	goal := validTestGoal()
	goal.ID = primitive.NewObjectID()
	goal.UserID = primitive.NewObjectID()
	goal.Status = models.GoalStatusActive
	goal.DefinitionVersion = 9
	goal.UpdatedAt = time.Now().UTC().Truncate(time.Millisecond)
	filter := goalDefinitionCurrentFilter(goal, nil)
	if filter["_id"] != goal.ID || filter["userId"] != goal.UserID || filter["status"] != models.GoalStatusActive || filter["updatedAt"] != goal.UpdatedAt {
		t.Fatalf("activity fence=%#v", filter)
	}
	if _, ok := filter["deleteState"]; !ok {
		t.Fatalf("activity fence lacks deletion state: %#v", filter)
	}
	if got := filter["definitionVersion"]; got != goal.DefinitionVersion {
		t.Fatalf("definitionVersion=%#v want %d", got, goal.DefinitionVersion)
	}
}
