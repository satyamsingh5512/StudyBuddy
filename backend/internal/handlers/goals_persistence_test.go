package handlers

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type mutableGoalStore struct {
	transactionErr error
	goal           models.Goal
	completions    []models.GoalCompletion
	showUps        map[string]models.ShowUp
	calls          []string
	hooks          map[string]func(*mutableGoalStore)
	cleanupErr     error
	recomputeErr   error
	restoredShowUp *models.ShowUp
}

func (f *mutableGoalStore) call(name string) {
	f.calls = append(f.calls, name)
	if hook := f.hooks[name]; hook != nil {
		hook(f)
	}
}

func (f *mutableGoalStore) RunTransaction(ctx context.Context, fn func(context.Context) error) error {
	f.call("transaction")
	if f.transactionErr != nil {
		return f.transactionErr
	}
	return fn(ctx)
}

func (f *mutableGoalStore) SaveGoalDefinition(_ context.Context, _ time.Time, expectedVersion int64, goal *models.Goal) error {
	f.call("save")
	if f.goal.DefinitionVersion != expectedVersion {
		return errGoalConflict
	}
	f.goal = *goal
	f.goal.SubGoals = append([]models.SubGoal(nil), goal.SubGoals...)
	f.call("after-save")
	return nil
}

func (f *mutableGoalStore) CleanupStaleGoalActivity(_ context.Context, goal models.Goal) error {
	f.call("cleanup")
	kept := f.completions[:0]
	for _, entry := range f.completions {
		if completionBelongsToCurrentDefinition(goal, entry) {
			kept = append(kept, entry)
		}
	}
	f.completions = kept
	for date, entry := range f.showUps {
		if entry.Source == models.GoalSourceAutomatic && entry.DefinitionVersion != goal.DefinitionVersion {
			delete(f.showUps, date)
		}
	}
	f.call("after-cleanup")
	return f.cleanupErr
}

func (f *mutableGoalStore) GoalDefinitionCurrent(_ context.Context, goal models.Goal, subGoalID *primitive.ObjectID) (bool, error) {
	f.call("check-current")
	if f.goal.ID != goal.ID || f.goal.UserID != goal.UserID || f.goal.DefinitionVersion != goal.DefinitionVersion || f.goal.DeleteState != "" {
		return false, nil
	}
	return subGoalID == nil || findSubGoal(f.goal, *subGoalID), nil
}

func sameCompletion(left, right models.GoalCompletion) bool {
	return left.UserID == right.UserID && left.GoalID == right.GoalID &&
		left.SubGoalID == right.SubGoalID && left.Date == right.Date
}

func (f *mutableGoalStore) UpsertGoalCompletion(_ context.Context, entry models.GoalCompletion) (models.GoalCompletion, error) {
	f.call("upsert-completion")
	for i := range f.completions {
		if !sameCompletion(f.completions[i], entry) {
			continue
		}
		if f.completions[i].DefinitionVersion > entry.DefinitionVersion {
			return models.GoalCompletion{}, errGoalDefinitionStale
		}
		f.completions[i] = entry
		f.call("after-upsert-completion")
		return entry, nil
	}
	f.completions = append(f.completions, entry)
	f.call("after-upsert-completion")
	return entry, nil
}

func (f *mutableGoalStore) DeleteGoalCompletion(_ context.Context, entry models.GoalCompletion) (bool, error) {
	f.call("delete-completion")
	deleted := false
	kept := f.completions[:0]
	for _, candidate := range f.completions {
		if sameCompletion(candidate, entry) && candidate.DefinitionVersion == entry.DefinitionVersion {
			deleted = true
			continue
		}
		kept = append(kept, candidate)
	}
	f.completions = kept
	f.call("after-delete-completion")
	return deleted, nil
}

func (f *mutableGoalStore) FindShowUp(_ context.Context, _ models.Goal, date string) (models.ShowUp, error) {
	f.call("find-show-up")
	entry, ok := f.showUps[date]
	if !ok {
		return models.ShowUp{}, mongo.ErrNoDocuments
	}
	return entry, nil
}

func (f *mutableGoalStore) FindCurrentGoalCompletions(_ context.Context, goal models.Goal, date string) ([]models.GoalCompletion, error) {
	f.call("find-current-completions")
	entries := make([]models.GoalCompletion, 0)
	for _, entry := range f.completions {
		if entry.Date == date && completionBelongsToCurrentDefinition(goal, entry) {
			entries = append(entries, entry)
		}
	}
	f.call("after-find-current-completions")
	return entries, nil
}

func (f *mutableGoalStore) UpsertAutomaticShowUp(_ context.Context, goal models.Goal, date, status string) error {
	f.call("upsert-automatic")
	if existing, ok := f.showUps[date]; ok && existing.Source == models.GoalSourceManual {
		return nil
	}
	f.showUps[date] = models.ShowUp{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID,
		DefinitionVersion: goal.DefinitionVersion, Date: date,
		Status: status, Source: models.GoalSourceAutomatic,
	}
	f.call("after-upsert-automatic")
	return nil
}

func (f *mutableGoalStore) DeleteAutomaticShowUp(_ context.Context, goal models.Goal, date string) error {
	f.call("delete-automatic")
	if existing, ok := f.showUps[date]; ok && existing.Source == models.GoalSourceAutomatic && existing.DefinitionVersion == goal.DefinitionVersion {
		delete(f.showUps, date)
	}
	return nil
}

func (f *mutableGoalStore) RecomputeAutomaticShowUp(ctx context.Context, goal models.Goal, date string) error {
	f.call("recompute:" + date)
	if f.recomputeErr != nil {
		return f.recomputeErr
	}
	return recomputeAutomaticShowUpWithStore(ctx, f, goal, date)
}

func (f *mutableGoalStore) FindAndDeleteShowUp(_ context.Context, userID, goalID primitive.ObjectID, date string) (models.ShowUp, error) {
	f.call("delete-show-up:" + date)
	entry, ok := f.showUps[date]
	if !ok || entry.UserID != userID || entry.GoalID != goalID {
		return models.ShowUp{}, mongo.ErrNoDocuments
	}
	delete(f.showUps, date)
	return entry, nil
}

func (f *mutableGoalStore) RestoreShowUp(_ context.Context, entry models.ShowUp) error {
	f.call("restore-show-up")
	if _, exists := f.showUps[entry.Date]; !exists {
		f.showUps[entry.Date] = entry
	}
	f.restoredShowUp = &entry
	return nil
}

func staleCompletion(goal models.Goal, date string) models.GoalCompletion {
	return models.GoalCompletion{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID,
		SubGoalID: goal.SubGoals[0].ID, DefinitionVersion: goal.DefinitionVersion,
		Date: date, Status: models.GoalActivityComplete, Source: models.GoalSourceManual,
	}
}

func TestSaveSubGoalDefinitionCleansRowsInsertedBeforeAndAfterSave(t *testing.T) {
	oldGoal := validTestGoal()
	newGoal := oldGoal
	newGoal.DefinitionVersion++
	newGoal.UpdatedAt = time.Now().UTC()
	beforeSave := staleCompletion(oldGoal, "2026-08-06")
	afterSave := staleCompletion(oldGoal, "2026-08-07")
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           oldGoal,
		completions:    []models.GoalCompletion{beforeSave},
		showUps:        map[string]models.ShowUp{},
		hooks: map[string]func(*mutableGoalStore){
			"after-save": func(f *mutableGoalStore) { f.completions = append(f.completions, afterSave) },
		},
	}
	if err := saveSubGoalDefinition(context.Background(), store, oldGoal.UpdatedAt, oldGoal.DefinitionVersion, &newGoal); err != nil {
		t.Fatalf("versioned save failed: %v", err)
	}
	if len(store.completions) != 0 {
		t.Fatalf("stale rows inserted before/after save survived cleanup: %#v", store.completions)
	}
	wantCalls := []string{"transaction", "save", "after-save", "cleanup", "after-cleanup"}
	if !reflect.DeepEqual(store.calls, wantCalls) {
		t.Fatalf("unexpected save-first order: got %#v want %#v", store.calls, wantCalls)
	}
}

func TestStandaloneRowInsertedAfterCleanupIsHistoricalAndUnreadable(t *testing.T) {
	oldGoal := validTestGoal()
	newGoal := oldGoal
	newGoal.DefinitionVersion++
	late := staleCompletion(oldGoal, "2026-08-07")
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           oldGoal,
		showUps:        map[string]models.ShowUp{},
		hooks: map[string]func(*mutableGoalStore){
			"after-cleanup": func(f *mutableGoalStore) { f.completions = append(f.completions, late) },
		},
	}
	if err := saveSubGoalDefinition(context.Background(), store, oldGoal.UpdatedAt, oldGoal.DefinitionVersion, &newGoal); err != nil {
		t.Fatalf("versioned save failed: %v", err)
	}
	if len(store.completions) != 1 {
		t.Fatalf("race fixture did not leave its historical row: %#v", store.completions)
	}
	visible, err := store.FindCurrentGoalCompletions(context.Background(), newGoal, late.Date)
	if err != nil || len(visible) != 0 {
		t.Fatalf("stale historical row leaked into current reads: entries=%#v err=%v", visible, err)
	}
}

func TestStaleCompletionWriterCleansItsRowAndNeverCreatesCurrentAutomaticShowUp(t *testing.T) {
	loaded := validTestGoal()
	current := loaded
	current.DefinitionVersion++
	entry := staleCompletion(loaded, "2026-08-07")
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           loaded,
		showUps:        map[string]models.ShowUp{},
		hooks: map[string]func(*mutableGoalStore){
			"after-upsert-completion": func(f *mutableGoalStore) {
				f.goal = current
			},
		},
	}
	if _, err := putGoalCompletionFenced(context.Background(), store, loaded, entry); !errors.Is(err, errGoalDefinitionStale) {
		t.Fatalf("stale writer error = %v, want definition conflict", err)
	}
	if len(store.completions) != 0 {
		t.Fatalf("stale writer row was not cleaned: %#v", store.completions)
	}
	if automatic, exists := store.showUps[entry.Date]; exists && automatic.Source == models.GoalSourceAutomatic && automatic.DefinitionVersion == current.DefinitionVersion {
		t.Fatalf("stale writer created a current automatic show-up: %#v", automatic)
	}
}

func TestStaleRecomputeRemovesAutomaticRowWrittenBeforeVersionChanges(t *testing.T) {
	loaded := validTestGoal()
	entry := staleCompletion(loaded, "2026-08-07")
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           loaded,
		completions:    []models.GoalCompletion{entry},
		showUps:        map[string]models.ShowUp{},
		hooks: map[string]func(*mutableGoalStore){
			"after-upsert-automatic": func(f *mutableGoalStore) { f.goal.DefinitionVersion++ },
		},
	}
	if err := recomputeAutomaticShowUpWithStore(context.Background(), store, loaded, entry.Date); !errors.Is(err, errGoalDefinitionStale) {
		t.Fatalf("stale recompute error = %v, want definition conflict", err)
	}
	if _, exists := store.showUps[entry.Date]; exists {
		t.Fatalf("stale automatic show-up survived post-write fence: %#v", store.showUps[entry.Date])
	}
}

func TestCurrentReadFilteringRequiresVersionAndValidSubGoal(t *testing.T) {
	goal := validTestGoal()
	valid := staleCompletion(goal, "2026-08-07")
	wrongVersion := valid
	wrongVersion.DefinitionVersion--
	removedSubGoal := valid
	removedSubGoal.SubGoalID = primitive.NewObjectID()
	if !completionBelongsToCurrentDefinition(goal, valid) || completionBelongsToCurrentDefinition(goal, wrongVersion) || completionBelongsToCurrentDefinition(goal, removedSubGoal) {
		t.Fatal("completion current-definition filtering is not version/sub-goal strict")
	}
	manual := models.ShowUp{Source: models.GoalSourceManual}
	currentAutomatic := models.ShowUp{Source: models.GoalSourceAutomatic, DefinitionVersion: goal.DefinitionVersion}
	staleAutomatic := models.ShowUp{Source: models.GoalSourceAutomatic, DefinitionVersion: goal.DefinitionVersion - 1}
	if !showUpBelongsToCurrentDefinition(goal, manual) || !showUpBelongsToCurrentDefinition(goal, currentAutomatic) || showUpBelongsToCurrentDefinition(goal, staleAutomatic) {
		t.Fatal("show-up current-definition filtering broke manual/current precedence")
	}
}

func TestManualShowUpSurvivesDefinitionEditsAndStaleRecompute(t *testing.T) {
	loaded := validTestGoal()
	date := "2026-08-07"
	manual := models.ShowUp{
		ID: primitive.NewObjectID(), UserID: loaded.UserID, GoalID: loaded.ID,
		Date: date, Status: models.GoalActivityPartial, Source: models.GoalSourceManual,
	}
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           loaded,
		completions:    []models.GoalCompletion{staleCompletion(loaded, date)},
		showUps:        map[string]models.ShowUp{date: manual},
		hooks:          map[string]func(*mutableGoalStore){},
	}
	if err := recomputeAutomaticShowUpWithStore(context.Background(), store, loaded, date); err != nil {
		t.Fatalf("current recompute rejected manual precedence: %v", err)
	}
	store.goal.DefinitionVersion++
	if err := recomputeAutomaticShowUpWithStore(context.Background(), store, loaded, date); !errors.Is(err, errGoalDefinitionStale) {
		t.Fatalf("stale recompute error = %v, want definition conflict", err)
	}
	if got := store.showUps[date]; got.ID != manual.ID || got.Source != models.GoalSourceManual {
		t.Fatalf("manual show-up was changed by definition edit/recompute: %#v", got)
	}
}

func TestStandaloneCleanupFailureDoesNotInvalidateSavedFence(t *testing.T) {
	oldGoal := validTestGoal()
	newGoal := oldGoal
	newGoal.DefinitionVersion++
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           oldGoal,
		showUps:        map[string]models.ShowUp{},
		hooks:          map[string]func(*mutableGoalStore){},
		cleanupErr:     errors.New("cleanup failed"),
	}
	if err := saveSubGoalDefinition(context.Background(), store, oldGoal.UpdatedAt, oldGoal.DefinitionVersion, &newGoal); err != nil {
		t.Fatalf("best-effort standalone cleanup should not roll back the visible fence: %v", err)
	}
	if store.goal.DefinitionVersion != newGoal.DefinitionVersion {
		t.Fatalf("new definition fence was not retained: %#v", store.goal)
	}
}

func TestDeleteShowUpFallbackRecomputesAndRestoresOnFailure(t *testing.T) {
	goal := validTestGoal()
	entry := models.ShowUp{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID,
		Date: "2026-08-07", Source: models.GoalSourceManual,
	}
	store := &mutableGoalStore{
		transactionErr: errTransactionsUnavailable,
		goal:           goal,
		showUps:        map[string]models.ShowUp{entry.Date: entry},
		hooks:          map[string]func(*mutableGoalStore){},
		recomputeErr:   errors.New("recompute failed"),
	}
	if err := deleteShowUpAndRecompute(context.Background(), store, goal, entry.Date); err == nil {
		t.Fatal("expected recompute failure")
	}
	if store.restoredShowUp == nil || store.restoredShowUp.ID != entry.ID {
		t.Fatalf("deleted show-up was not compensated: %#v", store.restoredShowUp)
	}
	want := []string{"transaction", "delete-show-up:2026-08-07", "recompute:2026-08-07", "restore-show-up"}
	if !reflect.DeepEqual(store.calls, want) {
		t.Fatalf("unexpected show-up mutation order: %#v", store.calls)
	}
}

func TestDeletingGoalFailsActivityGenerationFence(t *testing.T) {
	loaded := validTestGoal()
	store := &mutableGoalStore{goal: loaded, showUps: map[string]models.ShowUp{}, hooks: map[string]func(*mutableGoalStore){}}
	store.goal.DeleteState = goalDeleteStateDeleting
	store.goal.DefinitionVersion++
	current, err := store.GoalDefinitionCurrent(context.Background(), loaded, nil)
	if err != nil {
		t.Fatal(err)
	}
	if current {
		t.Fatal("activity writer remained current after delete tombstone/version fence")
	}
	filter := goalDefinitionCurrentFilter(loaded, nil)
	deleteState, ok := filter["deleteState"].(primitive.M)
	if !ok || deleteState["$exists"] != false {
		t.Fatalf("Mongo activity fence does not exclude delete tombstones: %#v", filter)
	}
}
