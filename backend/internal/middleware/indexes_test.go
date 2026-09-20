package middleware

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func findIndexByName(t *testing.T, specs map[string][]indexSpec, collection, name string) indexSpec {
	t.Helper()
	for _, spec := range specs[collection] {
		if spec.opts != nil && spec.opts.Name != nil && *spec.opts.Name == name {
			return spec
		}
	}
	t.Fatalf("index %s.%s not found", collection, name)
	return indexSpec{}
}

func TestCriticalIndexSpecifications(t *testing.T) {
	specs := indexSpecifications()
	tests := []struct {
		collection string
		name       string
		keys       bson.D
		unique     bool
	}{
		{"journal_entries", "uq_journal_entries_user_date", bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}}, true},
		{"journal_entries", "idx_journal_entries_user_attachments", bson.D{{Key: "userId", Value: 1}, {Key: "attachmentIds", Value: 1}}, false},
		{"journal_attachments", "idx_journal_attachments_user_deletion", bson.D{{Key: "userId", Value: 1}, {Key: "deletionState", Value: 1}}, false},
		{"goal_completions", "uq_goal_completions_user_goal_subgoal_date", bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "subGoalId", Value: 1}, {Key: "date", Value: 1}}, true},
		{"show_ups", "uq_show_ups_user_goal_date", bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "date", Value: 1}}, true},
		{"goal_check_ins", "uq_goal_check_ins_user_goal_weekStart", bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "weekStart", Value: 1}}, true},
		{"availabilities", "uq_availabilities_userId", bson.D{{Key: "userId", Value: 1}}, true},
		{"schedules", "idx_schedules_userId_date_createdAt", bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}, {Key: "createdAt", Value: -1}}, false},
		{"schedules", "idx_schedules_userId_createdAt", bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, false},
		{"daily_reports", "idx_reports_userId_date", bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}}, false},
		{"timer_sessions", "idx_timer_userId_createdAt", bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, false},
		{"todos", "idx_todos_userId_completedAt", bson.D{{Key: "userId", Value: 1}, {Key: "completed", Value: 1}, {Key: "completedAt", Value: -1}}, false},
		{"focus_sessions", "uq_focus_user_active", bson.D{{Key: "userId", Value: 1}}, true},
		{"focus_sessions", "ttl_focus_updated", bson.D{{Key: "updatedAt", Value: 1}}, false},
		{"waitlist", "uq_waitlist_email", bson.D{{Key: "email", Value: 1}}, true},
	}
	for _, test := range tests {
		spec := findIndexByName(t, specs, test.collection, test.name)
		if !reflect.DeepEqual(spec.keys, test.keys) {
			t.Errorf("%s keys=%#v want %#v", test.name, spec.keys, test.keys)
		}
		isUnique := spec.opts.Unique != nil && *spec.opts.Unique
		if isUnique != test.unique {
			t.Errorf("%s unique=%v want %v", test.name, isUnique, test.unique)
		}
	}
}

func TestJournalSlotQuotaIndexIsUniqueAndPartial(t *testing.T) {
	spec := findIndexByName(t, indexSpecifications(), "journal_attachments", "uq_journal_attachments_user_slot")
	if spec.opts.Unique == nil || !*spec.opts.Unique || spec.opts.PartialFilterExpression == nil {
		t.Fatalf("quota index options=%#v", spec.opts)
	}
}

func TestStudyRoomIndexSpecifications(t *testing.T) {
	specs := indexSpecifications()
	tests := []struct {
		collection string
		name       string
		keys       bson.D
		unique     bool
	}{
		// (roomId,userId) uniqueness is what makes concurrent joins idempotent
		// and keeps memberCount from being double-incremented.
		{"room_members", "uq_room_members_room_user", bson.D{{Key: "roomId", Value: 1}, {Key: "userId", Value: 1}}, true},
		{"room_members", "idx_room_members_user_status", bson.D{{Key: "userId", Value: 1}, {Key: "status", Value: 1}, {Key: "lastSeenAt", Value: -1}}, false},
		{"room_presence", "uq_room_presence_room_user", bson.D{{Key: "roomId", Value: 1}, {Key: "userId", Value: 1}}, true},
		// Uniqueness here is what makes the XP award idempotent under retries.
		{"room_session_participants", "uq_room_participants_session_user", bson.D{{Key: "sessionId", Value: 1}, {Key: "userId", Value: 1}}, true},
		{"room_session_participants", "idx_room_participants_room_completed", bson.D{{Key: "roomId", Value: 1}, {Key: "completedAt", Value: -1}}, false},
		{"room_messages", "idx_room_messages_room_id", bson.D{{Key: "roomId", Value: 1}, {Key: "_id", Value: -1}}, false},
		{"study_rooms", "uq_study_rooms_slug", bson.D{{Key: "slug", Value: 1}}, true},
		{"study_rooms", "idx_study_rooms_discovery", bson.D{{Key: "archived", Value: 1}, {Key: "visibility", Value: 1}, {Key: "lastActivityAt", Value: -1}}, false},
	}
	for _, test := range tests {
		spec := findIndexByName(t, specs, test.collection, test.name)
		if !reflect.DeepEqual(spec.keys, test.keys) {
			t.Errorf("%s keys=%#v want %#v", test.name, spec.keys, test.keys)
		}
		isUnique := spec.opts.Unique != nil && *spec.opts.Unique
		if isUnique != test.unique {
			t.Errorf("%s unique=%v want %v", test.name, isUnique, test.unique)
		}
	}
}

func TestRoomPresenceTTLExpiresAtStoredTime(t *testing.T) {
	// expireAfterSeconds must be 0 so Mongo expires each document at its own
	// expiresAt value. Any other value silently changes presence semantics and
	// members would appear online long after they left.
	spec := findIndexByName(t, indexSpecifications(), "room_presence", "ttl_room_presence")
	if spec.opts.ExpireAfterSeconds == nil || *spec.opts.ExpireAfterSeconds != 0 {
		t.Fatalf("presence TTL expireAfterSeconds=%v, want 0", spec.opts.ExpireAfterSeconds)
	}
	if !reflect.DeepEqual(spec.keys, bson.D{{Key: "expiresAt", Value: 1}}) {
		t.Fatalf("presence TTL keys=%#v", spec.keys)
	}
}

func TestEveryRoomCollectionIsIndexed(t *testing.T) {
	specs := indexSpecifications()
	// Every new collection a handler writes to must have at least one index, or
	// Atlas M0 will collection-scan it under load.
	for _, collection := range []string{
		"study_rooms", "room_members", "room_presence", "room_sessions",
		"room_session_participants", "room_messages", "room_resources",
	} {
		if len(specs[collection]) == 0 {
			t.Errorf("collection %q has no indexes", collection)
		}
	}
}
