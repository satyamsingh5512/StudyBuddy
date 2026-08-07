package handlers

import (
	"context"
	"errors"
	"reflect"
	"strconv"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownedGoalActivity struct {
	userID primitive.ObjectID
	goalID primitive.ObjectID
}

type fakeGoalDeletionStore struct {
	transactionErr error
	goal           *models.Goal
	completions    []ownedGoalActivity
	showUps        []ownedGoalActivity
	checkIns       []ownedGoalActivity
	fail           map[string]error
	calls          []string
	callCounts     map[string]int
	afterCall      map[string]func(*fakeGoalDeletionStore)
}

func (f *fakeGoalDeletionStore) record(name string) error {
	f.calls = append(f.calls, name)
	f.callCounts[name]++
	return f.fail[name]
}

func (f *fakeGoalDeletionStore) after(name string) {
	if hook := f.afterCall[name+"#"+strconv.Itoa(f.callCounts[name])]; hook != nil {
		hook(f)
	}
}

func (f *fakeGoalDeletionStore) RunTransaction(ctx context.Context, fn func(context.Context) error) error {
	if err := f.record("transaction"); err != nil {
		return err
	}
	if f.transactionErr != nil {
		return f.transactionErr
	}
	return fn(ctx)
}

func (f *fakeGoalDeletionStore) FenceGoalDeletion(_ context.Context, userID, goalID primitive.ObjectID, token string, now time.Time) (models.Goal, error) {
	if err := f.record("fence"); err != nil {
		return models.Goal{}, err
	}
	if f.goal == nil || f.goal.ID != goalID || f.goal.UserID != userID {
		return models.Goal{}, mongo.ErrNoDocuments
	}
	if f.goal.DeleteState == "" {
		f.goal.DeleteState = goalDeleteStateDeleting
		f.goal.DeleteToken = token
		f.goal.DeletingAt = &now
		f.goal.DefinitionVersion++
	}
	return *f.goal, nil
}

func deleteScopedActivity(rows []ownedGoalActivity, userID, goalID primitive.ObjectID) []ownedGoalActivity {
	kept := rows[:0]
	for _, row := range rows {
		if row.userID != userID || row.goalID != goalID {
			kept = append(kept, row)
		}
	}
	return kept
}

func (f *fakeGoalDeletionStore) DeleteGoalCompletions(_ context.Context, userID, goalID primitive.ObjectID) error {
	if err := f.record("delete-completions"); err != nil {
		return err
	}
	f.completions = deleteScopedActivity(f.completions, userID, goalID)
	f.after("delete-completions")
	return nil
}

func (f *fakeGoalDeletionStore) DeleteGoalShowUps(_ context.Context, userID, goalID primitive.ObjectID) error {
	if err := f.record("delete-show-ups"); err != nil {
		return err
	}
	f.showUps = deleteScopedActivity(f.showUps, userID, goalID)
	f.after("delete-show-ups")
	return nil
}

func (f *fakeGoalDeletionStore) DeleteGoalCheckIns(_ context.Context, userID, goalID primitive.ObjectID) error {
	if err := f.record("delete-check-ins"); err != nil {
		return err
	}
	f.checkIns = deleteScopedActivity(f.checkIns, userID, goalID)
	f.after("delete-check-ins")
	return nil
}

func (f *fakeGoalDeletionStore) FinishGoalDeletion(_ context.Context, userID, goalID primitive.ObjectID, token string) (bool, error) {
	if err := f.record("finish"); err != nil {
		return false, err
	}
	if f.goal == nil || f.goal.ID != goalID || f.goal.UserID != userID ||
		f.goal.DeleteState != goalDeleteStateDeleting || f.goal.DeleteToken != token {
		return false, nil
	}
	f.goal = nil
	return true, nil
}

func deletionFixture() (*fakeGoalDeletionStore, models.Goal, primitive.ObjectID, primitive.ObjectID) {
	goal := validTestGoal()
	otherUser, otherGoal := primitive.NewObjectID(), primitive.NewObjectID()
	rows := []ownedGoalActivity{
		{userID: goal.UserID, goalID: goal.ID},
		{userID: otherUser, goalID: goal.ID},
		{userID: goal.UserID, goalID: otherGoal},
	}
	store := &fakeGoalDeletionStore{
		transactionErr: errTransactionsUnavailable,
		goal:           &goal,
		completions:    append([]ownedGoalActivity(nil), rows...),
		showUps:        append([]ownedGoalActivity(nil), rows...),
		checkIns:       append([]ownedGoalActivity(nil), rows...),
		fail:           map[string]error{},
		callCounts:     map[string]int{},
		afterCall:      map[string]func(*fakeGoalDeletionStore){},
	}
	return store, goal, otherUser, otherGoal
}

func assertOnlyUnrelatedActivity(t *testing.T, rows []ownedGoalActivity, goal models.Goal, otherUser, otherGoal primitive.ObjectID) {
	t.Helper()
	want := []ownedGoalActivity{{userID: otherUser, goalID: goal.ID}, {userID: goal.UserID, goalID: otherGoal}}
	if !reflect.DeepEqual(rows, want) {
		t.Fatalf("owner-scoped cleanup = %#v, want %#v", rows, want)
	}
}

func TestDeleteGoalStandaloneRetainsTombstoneAndReturnsPendingAfterDoubleSweep(t *testing.T) {
	store, goal, otherUser, otherGoal := deletionFixture()
	result, err := deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil {
		t.Fatalf("standalone delete failed: %v", err)
	}
	if !result.CleanupPending || result.CleanupError != nil {
		t.Fatalf("standalone result = %#v, want clean pending state", result)
	}
	wantCalls := []string{
		"transaction", "fence",
		"delete-completions", "delete-show-ups", "delete-check-ins",
		"delete-completions", "delete-show-ups", "delete-check-ins",
	}
	if !reflect.DeepEqual(store.calls, wantCalls) {
		t.Fatalf("delete order = %#v, want %#v", store.calls, wantCalls)
	}
	if store.goal == nil || store.goal.DeleteState != goalDeleteStateDeleting || store.goal.DeleteToken == "" {
		t.Fatalf("standalone delete did not retain durable tombstone: %#v", store.goal)
	}
	if store.goal.DefinitionVersion != goal.DefinitionVersion+1 {
		t.Fatalf("delete fence version = %d, want %d", store.goal.DefinitionVersion, goal.DefinitionVersion+1)
	}
	assertOnlyUnrelatedActivity(t, store.completions, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.showUps, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.checkIns, goal, otherUser, otherGoal)
}

func TestDeleteGoalStandaloneSecondSweepCleansAllActivityInsertedBetweenSweeps(t *testing.T) {
	store, goal, otherUser, otherGoal := deletionFixture()
	insertOwnedRows := func(store *fakeGoalDeletionStore) {
		row := ownedGoalActivity{userID: goal.UserID, goalID: goal.ID}
		store.completions = append(store.completions, row)
		store.showUps = append(store.showUps, row)
		store.checkIns = append(store.checkIns, row)
	}
	store.afterCall["delete-check-ins#1"] = insertOwnedRows

	result, err := deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || !result.CleanupPending {
		t.Fatalf("interleaved delete result=%#v error=%v", result, err)
	}
	assertOnlyUnrelatedActivity(t, store.completions, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.showUps, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.checkIns, goal, otherUser, otherGoal)
	if store.goal == nil || store.goal.DeleteState != goalDeleteStateDeleting {
		t.Fatal("standalone delete finalized despite inability to prove stale-writer quiescence")
	}
}

func TestDeleteGoalStandaloneWriterCleanupFailureLeavesPendingStateForIdempotentRetry(t *testing.T) {
	store, goal, otherUser, otherGoal := deletionFixture()
	// Model completion, manual show-up, and check-in writers that loaded before
	// the fence, commit after both sweeps, and then fail their post-write cleanup.
	store.afterCall["delete-check-ins#2"] = func(store *fakeGoalDeletionStore) {
		row := ownedGoalActivity{userID: goal.UserID, goalID: goal.ID}
		store.completions = append(store.completions, row)
		store.showUps = append(store.showUps, row)
		store.checkIns = append(store.checkIns, row)
	}
	result, err := deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || !result.CleanupPending {
		t.Fatalf("late writer result=%#v error=%v", result, err)
	}
	if store.goal == nil || store.goal.DeleteState != goalDeleteStateDeleting {
		t.Fatal("durable pending tombstone was lost while stale rows remained")
	}
	if len(store.completions) != 3 || len(store.showUps) != 3 || len(store.checkIns) != 3 {
		t.Fatalf("deterministic late rows missing: completions=%#v showUps=%#v checkIns=%#v", store.completions, store.showUps, store.checkIns)
	}

	delete(store.afterCall, "delete-check-ins#2")
	store.calls = nil
	result, err = deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || !result.CleanupPending {
		t.Fatalf("idempotent standalone retry result=%#v error=%v", result, err)
	}
	assertOnlyUnrelatedActivity(t, store.completions, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.showUps, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.checkIns, goal, otherUser, otherGoal)
	if store.goal == nil {
		t.Fatal("standalone retry falsely finalized permanent deletion")
	}

	// If this deployment later gains transaction support, DELETE can atomically
	// clean and finalize the same persisted tombstone/token.
	store.transactionErr = nil
	store.calls = nil
	result, err = deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || result.CleanupPending || store.goal != nil {
		t.Fatalf("transactional retry did not finalize: result=%#v error=%v goal=%#v", result, err, store.goal)
	}
}

func TestDeleteGoalStandaloneCleanupErrorsRemainAcceptedAndRetryable(t *testing.T) {
	store, goal, _, _ := deletionFixture()
	cleanupErr := errors.New("show-up cleanup failed")
	store.fail["delete-show-ups"] = cleanupErr

	result, err := deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || !result.CleanupPending || !errors.Is(result.CleanupError, cleanupErr) {
		t.Fatalf("cleanup failure result=%#v error=%v", result, err)
	}
	if store.goal == nil || store.goal.DeleteState != goalDeleteStateDeleting {
		t.Fatalf("cleanup failure lost recoverable tombstone: %#v", store.goal)
	}
	if store.callCounts["delete-completions"] != 2 || store.callCounts["delete-show-ups"] != 2 || store.callCounts["delete-check-ins"] != 2 {
		t.Fatalf("cleanup failure prevented best-effort sweeps: %#v", store.callCounts)
	}
}

func TestDeleteGoalTransactionAtomicallyFinalizes(t *testing.T) {
	store, goal, otherUser, otherGoal := deletionFixture()
	store.transactionErr = nil
	result, err := deleteGoalWithStore(context.Background(), store, goal.UserID, goal.ID)
	if err != nil || result.CleanupPending {
		t.Fatalf("transactional delete result=%#v error=%v", result, err)
	}
	wantCalls := []string{"transaction", "fence", "delete-completions", "delete-show-ups", "delete-check-ins", "finish"}
	if !reflect.DeepEqual(store.calls, wantCalls) || store.goal != nil {
		t.Fatalf("transactional delete calls=%#v goal=%#v", store.calls, store.goal)
	}
	assertOnlyUnrelatedActivity(t, store.completions, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.showUps, goal, otherUser, otherGoal)
	assertOnlyUnrelatedActivity(t, store.checkIns, goal, otherUser, otherGoal)
}

func TestDeleteGoalWrongOwnerCannotFenceOrCleanActivity(t *testing.T) {
	store, goal, _, _ := deletionFixture()
	beforeCompletions := append([]ownedGoalActivity(nil), store.completions...)
	wrongOwner := primitive.NewObjectID()
	_, err := deleteGoalWithStore(context.Background(), store, wrongOwner, goal.ID)
	if !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatalf("wrong-owner delete error = %v, want not found", err)
	}
	if store.goal == nil || store.goal.DeleteState != "" || !reflect.DeepEqual(store.completions, beforeCompletions) {
		t.Fatal("wrong-owner delete mutated goal or dependent activity")
	}
}
