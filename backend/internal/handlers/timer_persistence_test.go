package handlers

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestTimerUserStatsUpdateUsesMaxForBestStreak(t *testing.T) {
	update := timerUserStatsUpdate(25, 25, 9, bson.M{"streak": 7})
	maximum, ok := update["$max"].(bson.M)
	if !ok || maximum["bestStreak"] != 9 {
		t.Fatalf("update=%#v", update)
	}
	set := update["$set"].(bson.M)
	if _, overwritesBest := set["bestStreak"]; overwritesBest {
		t.Fatalf("bestStreak must not be placed in $set: %#v", update)
	}
}
