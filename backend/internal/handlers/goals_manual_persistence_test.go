package handlers

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mutableManualShowUpStore struct {
	currentChecks []bool
	checkIndex    int
	row           *models.ShowUp
	finalizeErr   error
	onMutate      func(*mutableManualShowUpStore)
	onFinalize    func(*mutableManualShowUpStore)
	onCompensate  func(*mutableManualShowUpStore)
}

func (s *mutableManualShowUpStore) GoalActivityCurrent(context.Context, models.Goal) (bool, error) {
	if len(s.currentChecks) == 0 {
		return true, nil
	}
	if s.checkIndex >= len(s.currentChecks) {
		return s.currentChecks[len(s.currentChecks)-1], nil
	}
	value := s.currentChecks[s.checkIndex]
	s.checkIndex++
	return value, nil
}

func (s *mutableManualShowUpStore) MutateManualShowUp(_ context.Context, desired models.ShowUp, token string) (*models.ShowUp, models.ShowUp, error) {
	var previous *models.ShowUp
	if s.row != nil {
		if s.row.MutationToken != "" {
			return nil, models.ShowUp{}, errGoalConflict
		}
		copy := *s.row
		previous = &copy
		desired.ID, desired.CreatedAt = copy.ID, copy.CreatedAt
	}
	desired.MutationToken = token
	s.row = &desired
	if s.onMutate != nil {
		s.onMutate(s)
	}
	return previous, desired, nil
}

func (s *mutableManualShowUpStore) FinalizeManualShowUp(_ context.Context, saved models.ShowUp, token string) (models.ShowUp, error) {
	if s.onFinalize != nil {
		s.onFinalize(s)
	}
	if s.finalizeErr != nil {
		return models.ShowUp{}, s.finalizeErr
	}
	if s.row == nil || s.row.ID != saved.ID || s.row.MutationToken != token {
		return models.ShowUp{}, errGoalConflict
	}
	s.row.MutationToken = ""
	return *s.row, nil
}

func (s *mutableManualShowUpStore) CompensateManualShowUp(_ context.Context, previous *models.ShowUp, saved models.ShowUp, token string) error {
	if s.onCompensate != nil {
		s.onCompensate(s)
	}
	if s.row == nil || s.row.ID != saved.ID || s.row.MutationToken != token {
		return nil
	}
	if previous == nil {
		s.row = nil
	} else {
		copy := *previous
		copy.MutationToken = ""
		s.row = &copy
	}
	return nil
}

func manualFenceGoal() models.Goal {
	return models.Goal{ID: primitive.NewObjectID(), UserID: primitive.NewObjectID(), DefinitionVersion: 4, Status: models.GoalStatusActive, UpdatedAt: time.Now().UTC()}
}

func manualShowUpFor(goal models.Goal, date, status, source, note string, now time.Time) models.ShowUp {
	return models.ShowUp{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID, Date: date,
		Status: status, Source: source, Note: note, DefinitionVersion: goal.DefinitionVersion,
		CreatedAt: now.Add(-time.Hour), UpdatedAt: now.Add(-time.Hour),
	}
}

func TestManualShowUpPendingOwnerBlocksSecondWriterAcrossLifecycle(t *testing.T) {
	now := time.Now().UTC()
	for _, test := range []struct {
		name        string
		hasPrevious bool
	}{
		{name: "archive removes owners inserted row"},
		{name: "complete restores prior committed row", hasPrevious: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			goal := manualFenceGoal()
			var previous *models.ShowUp
			if test.hasPrevious {
				row := manualShowUpFor(goal, "2026-08-07", models.GoalActivityPartial, models.GoalSourceManual, "committed", now)
				previous = &row
			}
			store := &mutableManualShowUpStore{currentChecks: []bool{true, false}, row: previous}
			var secondErr error
			store.onMutate = func(s *mutableManualShowUpStore) {
				contender := models.ShowUp{
					ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID, Date: "2026-08-07",
					Status: models.GoalActivityComplete, Source: models.GoalSourceManual,
					CreatedAt: now.Add(time.Second), UpdatedAt: now.Add(time.Second),
				}
				_, _, secondErr = s.MutateManualShowUp(context.Background(), contender, "writer-b")
			}

			_, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityComplete, "writer-a", now)
			if !errors.Is(err, errGoalDefinitionStale) {
				t.Fatalf("writer A error = %v, want stale definition", err)
			}
			if !errors.Is(secondErr, errGoalConflict) {
				t.Fatalf("writer B error = %v, want retryable conflict", secondErr)
			}
			if previous == nil {
				if store.row != nil {
					t.Fatalf("inserted pending row was not removed: %#v", store.row)
				}
			} else if store.row == nil || !reflect.DeepEqual(*store.row, *previous) {
				t.Fatalf("prior committed row was not restored exactly: got %#v want %#v", store.row, previous)
			}
		})
	}
}

func TestManualShowUpFinalizeFailureCompensatesOwnedPendingRow(t *testing.T) {
	goal := manualFenceGoal()
	now := time.Now().UTC()
	finalizeErr := errors.New("finalize failed")
	for _, test := range []struct {
		name        string
		hasPrevious bool
	}{
		{name: "deletes inserted row"},
		{name: "restores prior committed row", hasPrevious: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var previous *models.ShowUp
			if test.hasPrevious {
				row := manualShowUpFor(goal, "2026-08-07", models.GoalActivityPartial, models.GoalSourceManual, "committed", now)
				previous = &row
			}
			store := &mutableManualShowUpStore{currentChecks: []bool{true, true}, row: previous, finalizeErr: finalizeErr}

			_, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityComplete, "pending", now)
			if !errors.Is(err, finalizeErr) {
				t.Fatalf("error = %v, want finalize failure", err)
			}
			if previous == nil {
				if store.row != nil {
					t.Fatalf("finalize cleanup did not delete inserted row: %#v", store.row)
				}
			} else if store.row == nil || !reflect.DeepEqual(*store.row, *previous) || store.row.MutationToken != "" {
				t.Fatalf("finalize cleanup did not restore committed row: got %#v want %#v", store.row, previous)
			}
		})
	}
}

func TestManualShowUpCompensationNeverOverwritesAnotherToken(t *testing.T) {
	goal := manualFenceGoal()
	store := &mutableManualShowUpStore{currentChecks: []bool{true, false}}
	store.onCompensate = func(s *mutableManualShowUpStore) {
		newer := *s.row
		newer.Note = "other owner"
		newer.MutationToken = "writer-b"
		s.row = &newer
	}

	_, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityComplete, "writer-a", time.Now().UTC())
	if !errors.Is(err, errGoalDefinitionStale) || store.row == nil || store.row.Note != "other owner" || store.row.MutationToken != "writer-b" {
		t.Fatalf("compensation touched another pending owner: err=%v row=%#v", err, store.row)
	}
}

func TestManualShowUpSecondWriterCleanupPreservesFirstFinalizedRow(t *testing.T) {
	goal := manualFenceGoal()
	store := &mutableManualShowUpStore{currentChecks: []bool{true, true}}
	now := time.Now().UTC()

	first, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityPartial, "writer-a", now)
	if err != nil || first.MutationToken != "" {
		t.Fatalf("writer A did not finalize: saved=%#v err=%v", first, err)
	}
	committed := first
	store.currentChecks = []bool{true, false}
	store.checkIndex = 0

	_, err = putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityComplete, "writer-b", now.Add(time.Second))
	if !errors.Is(err, errGoalDefinitionStale) {
		t.Fatalf("writer B error = %v, want stale definition", err)
	}
	if store.row == nil || !reflect.DeepEqual(*store.row, committed) || store.row.MutationToken != "" {
		t.Fatalf("writer B cleanup removed or changed writer A's valid row: got %#v want %#v", store.row, committed)
	}
}

func TestManualShowUpSecondWriterProceedsAfterFirstFinalizes(t *testing.T) {
	goal := manualFenceGoal()
	store := &mutableManualShowUpStore{currentChecks: []bool{true, true, true, true}}
	now := time.Now().UTC()

	first, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityPartial, "writer-a", now)
	if err != nil || first.MutationToken != "" || store.row == nil || store.row.MutationToken != "" {
		t.Fatalf("writer A did not finalize: saved=%#v err=%v row=%#v", first, err, store.row)
	}
	second, err := putManualShowUpFenced(context.Background(), store, goal, "2026-08-07", models.GoalActivityComplete, "writer-b", now.Add(time.Second))
	if err != nil || second.Note != "writer-b" || second.MutationToken != "" || store.row == nil || store.row.Note != "writer-b" || store.row.MutationToken != "" {
		t.Fatalf("writer B did not proceed after finalize: saved=%#v err=%v row=%#v", second, err, store.row)
	}
}

func TestManualShowUpDefinitionTransitionRestoresCommittedRow(t *testing.T) {
	goal := manualFenceGoal()
	now := time.Now().UTC()
	previous := manualShowUpFor(goal, "2026-08-07", models.GoalActivityPartial, models.GoalSourceManual, "before definition edit", now)
	store := &mutableManualShowUpStore{currentChecks: []bool{true, false}, row: &previous}

	_, err := putManualShowUpFenced(context.Background(), store, goal, previous.Date, models.GoalActivityComplete, "stale generation", now)
	if !errors.Is(err, errGoalDefinitionStale) || store.row == nil || !reflect.DeepEqual(*store.row, previous) {
		t.Fatalf("definition transition did not restore prior row: err=%v row=%#v", err, store.row)
	}
}

func TestManualShowUpWinsOverAutomaticAndFinalizes(t *testing.T) {
	goal := manualFenceGoal()
	now := time.Now().UTC()
	automatic := manualShowUpFor(goal, "2026-08-07", models.GoalActivityPartial, models.GoalSourceAutomatic, "", now)
	store := &mutableManualShowUpStore{currentChecks: []bool{true, true}, row: &automatic}

	saved, err := putManualShowUpFenced(context.Background(), store, goal, automatic.Date, models.GoalActivityComplete, "manual", now)
	if err != nil || saved.Source != models.GoalSourceManual || saved.MutationToken != "" || store.row == nil || store.row.Source != models.GoalSourceManual || store.row.Note != "manual" || store.row.MutationToken != "" {
		t.Fatalf("manual precedence/finalize failed: saved=%#v err=%v row=%#v", saved, err, store.row)
	}
}

func TestMutableManualShowUpStoreRejectsUnvalidatedPendingToken(t *testing.T) {
	goal := manualFenceGoal()
	now := time.Now().UTC()
	pending := manualShowUpFor(goal, "2026-08-07", models.GoalActivityPartial, models.GoalSourceManual, "owner-a", now)
	pending.MutationToken = "owner-a-token"
	store := &mutableManualShowUpStore{row: &pending}
	desired := manualShowUpFor(goal, pending.Date, models.GoalActivityComplete, models.GoalSourceManual, "owner-b", now.Add(time.Second))

	previous, _, err := store.MutateManualShowUp(context.Background(), desired, "owner-b-token")
	if !errors.Is(err, errGoalConflict) || previous != nil || store.row == nil || !reflect.DeepEqual(*store.row, pending) {
		t.Fatalf("pending token was overwritten or exposed as committed: previous=%#v err=%v row=%#v", previous, err, store.row)
	}
}

var _ manualShowUpStore = (*mutableManualShowUpStore)(nil)
