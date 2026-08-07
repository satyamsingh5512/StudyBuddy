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
		{"daily_reports", "idx_reports_userId_date", bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}}, false},
		{"timer_sessions", "idx_timer_userId_createdAt", bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, false},
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
