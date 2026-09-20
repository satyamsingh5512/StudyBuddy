package handlers

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestDeletionWipePlanCoversAllUserData(t *testing.T) {
	userID := primitive.NewObjectID()
	plan := deletionWipePlan(userID, "user@example.com")

	byCollection := map[string]bson.M{}
	for _, target := range plan {
		byCollection[target.collection] = target.filter
	}

	ownerScoped := []string{
		"todos", "notes", "timer_sessions", "goals", "goal_completions",
		"show_ups", "goal_check_ins", "journal_entries", "journal_attachments",
		"schedules", "availabilities", "daily_reports", "focus_sessions",
	}
	for _, collection := range ownerScoped {
		filter, ok := byCollection[collection]
		if !ok {
			t.Fatalf("wipe plan is missing collection %q", collection)
		}
		if filter["userId"] != userID {
			t.Fatalf("collection %q filter is not owner-scoped: %v", collection, filter)
		}
	}

	for _, collection := range []string{"direct_messages", "friend_requests"} {
		filter, ok := byCollection[collection]
		if !ok {
			t.Fatalf("wipe plan is missing collection %q", collection)
		}
		or, ok := filter["$or"].([]bson.M)
		if !ok || len(or) != 2 {
			t.Fatalf("collection %q must match both directions: %v", collection, filter)
		}
	}

	blocks, ok := byCollection["blocks"]
	if !ok {
		t.Fatal("wipe plan is missing collection \"blocks\"")
	}
	if _, ok := blocks["$or"].([]bson.M); !ok {
		t.Fatalf("blocks filter must match both sides: %v", blocks)
	}

	waitlist, ok := byCollection["waitlist"]
	if !ok {
		t.Fatal("wipe plan is missing waitlist cleanup")
	}
	if waitlist["email"] != "user@example.com" {
		t.Fatalf("waitlist filter must match the account email: %v", waitlist)
	}

	for _, shared := range []string{"users", "notices", "faqs"} {
		if _, ok := byCollection[shared]; ok {
			t.Fatalf("wipe plan must not touch shared collection %q", shared)
		}
	}
}

func TestDeletionWipePlanCoversStudyRoomData(t *testing.T) {
	userID := primitive.NewObjectID()
	plan := deletionWipePlan(userID, "user@example.com")
	byCollection := map[string]bson.M{}
	for _, target := range plan {
		byCollection[target.collection] = target.filter
	}

	// Every room collection holding this account's own data must be wiped, or the
	// success message ("all associated data have been permanently deleted") lies.
	for _, collection := range []string{
		"room_members", "room_presence", "room_session_participants", "room_messages",
	} {
		filter, ok := byCollection[collection]
		if !ok {
			t.Fatalf("wipe plan is missing collection %q", collection)
		}
		if filter["userId"] != userID {
			t.Fatalf("collection %q filter is not owner-scoped: %v", collection, filter)
		}
	}
	resources, ok := byCollection["room_resources"]
	if !ok || resources["addedBy"] != userID {
		t.Fatalf("room_resources must be scoped by addedBy: %v", resources)
	}

	// Rooms and sessions are shared with other members: deleting them would
	// destroy other people's data. They are archived instead.
	for _, shared := range []string{"study_rooms", "room_sessions"} {
		if _, ok := byCollection[shared]; ok {
			t.Fatalf("wipe plan must not delete shared room collection %q", shared)
		}
	}
}

func TestDeletionWipePlanWithoutEmail(t *testing.T) {
	plan := deletionWipePlan(primitive.NewObjectID(), "")
	for _, target := range plan {
		if target.collection == "waitlist" {
			t.Fatal("waitlist cleanup must be skipped when the email is empty")
		}
	}
}
