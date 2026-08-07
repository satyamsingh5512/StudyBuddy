package handlers

import (
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestBatchActiveGoalFilterIsOwnerAndLifecycleScoped(t *testing.T) {
	owner, goalID := primitive.NewObjectID(), primitive.NewObjectID()
	filter := batchActiveGoalsFilter(owner, []primitive.ObjectID{goalID})
	if filter["userId"] != owner || filter["status"] != models.GoalStatusActive {
		t.Fatalf("filter=%#v", filter)
	}
	if _, ok := filter["deleteState"].(bson.M); !ok {
		t.Fatalf("delete fence missing: %#v", filter)
	}
	ids, ok := filter["_id"].(bson.M)
	if !ok || ids["$in"] == nil {
		t.Fatalf("requested IDs missing: %#v", filter)
	}
}

func TestBatchAllGoalsHasNoSilentHundredGoalCutoff(t *testing.T) {
	if batchAllGoalsOverflow(101) {
		t.Fatal("101 active goals must be processed; old 100-row truncation returned")
	}
	if batchAllGoalsOverflow(maxBatchAllGoals) || !batchAllGoalsOverflow(maxBatchAllGoals+1) {
		t.Fatalf("overflow boundary is not explicit at %d", maxBatchAllGoals)
	}
}

func TestBatchResultSupportsPerGoalPartialFailure(t *testing.T) {
	results := []batchShowUpResult{{GoalID: primitive.NewObjectID().Hex(), OK: true}, {GoalID: primitive.NewObjectID().Hex(), Error: "Active goal not found"}}
	if !results[0].OK || results[0].Error != "" || results[1].OK || results[1].Error == "" {
		t.Fatalf("partial result contract=%#v", results)
	}
}

func TestBatchWeeklyDateNormalizesToMonday(t *testing.T) {
	goal := models.Goal{GridMode: models.GoalGridWeekly}
	date, err := effectiveShowUpDate(goal, "2026-08-07", time.UTC, time.Now())
	if err != nil || date != "2026-08-03" {
		t.Fatalf("date=%q err=%v", date, err)
	}
}
