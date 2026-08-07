package handlers

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestBuildTodoListQueryDefaults(t *testing.T) {
	userID := primitive.NewObjectID()
	query, err := buildTodoListQuery(userID, "", "", "", "", "", "", "", time.Now())
	if err != nil {
		t.Fatalf("buildTodoListQuery returned error: %v", err)
	}
	if query.limit != 200 || query.offset != 0 {
		t.Fatalf("pagination = limit %d offset %d, want 200/0", query.limit, query.offset)
	}

	clauses, ok := query.filter["$and"].(bson.A)
	if !ok || len(clauses) != 1 {
		t.Fatalf("filter clauses = %#v, want one user clause", query.filter)
	}
	if !reflect.DeepEqual(clauses[0], bson.M{"userId": userID}) {
		t.Fatalf("user clause = %#v", clauses[0])
	}
}

func TestBuildTodoListQueryDateAndCompletion(t *testing.T) {
	userID := primitive.NewObjectID()
	query, err := buildTodoListQuery(
		userID,
		"2026-08-06",
		"",
		"false",
		"50",
		"25",
		"UTC",
		"",
		time.Date(2026, time.August, 6, 20, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("buildTodoListQuery returned error: %v", err)
	}
	if query.limit != 50 || query.offset != 25 {
		t.Fatalf("pagination = limit %d offset %d, want 50/25", query.limit, query.offset)
	}

	clauses := query.filter["$and"].(bson.A)
	if len(clauses) != 3 {
		t.Fatalf("got %d clauses, want user + completion + date", len(clauses))
	}
	if !reflect.DeepEqual(clauses[1], bson.M{"completed": false}) {
		t.Fatalf("completion clause = %#v", clauses[1])
	}

	dateClause, ok := clauses[2].(bson.M)
	if !ok {
		t.Fatalf("date clause type = %T", clauses[2])
	}
	alternatives, ok := dateClause["$or"].(bson.A)
	if !ok || len(alternatives) != 2 {
		t.Fatalf("date alternatives = %#v, want scheduledDate and dueDate", dateClause)
	}

	wantStart := time.Date(2026, time.August, 6, 0, 0, 0, 0, time.UTC)
	wantEnd := wantStart.Add(24 * time.Hour)
	wantScheduled := bson.M{"scheduledDate": bson.M{"$gte": wantStart, "$lt": wantEnd}}
	wantDue := bson.M{"dueDate": bson.M{"$gte": wantStart, "$lt": wantEnd}}
	if !reflect.DeepEqual(alternatives[0], wantScheduled) || !reflect.DeepEqual(alternatives[1], wantDue) {
		t.Fatalf("date alternatives = %#v", alternatives)
	}
}

func TestBuildTodoListQueryAsiaKolkataCalendarBoundaries(t *testing.T) {
	userID := primitive.NewObjectID()
	now := time.Date(2026, time.August, 8, 6, 30, 0, 0, time.UTC) // Aug 8 noon in Kolkata.
	query, err := buildTodoListQuery(userID, "2026-08-08", "true", "", "", "", "Asia/Kolkata", "", now)
	if err != nil {
		t.Fatalf("buildTodoListQuery returned error: %v", err)
	}
	clauses := query.filter["$and"].(bson.A)
	if len(clauses) != 4 {
		t.Fatalf("got %d clauses, want user + date + incomplete + overdue", len(clauses))
	}

	midnight := time.Date(2026, time.August, 7, 18, 30, 0, 0, time.UTC)
	nextMidnight := time.Date(2026, time.August, 8, 18, 30, 0, 0, time.UTC)
	dateAlternatives := clauses[1].(bson.M)["$or"].(bson.A)
	wantScheduled := bson.M{"scheduledDate": bson.M{"$gte": midnight, "$lt": nextMidnight}}
	wantDue := bson.M{"dueDate": bson.M{"$gte": midnight, "$lt": nextMidnight}}
	if !reflect.DeepEqual(dateAlternatives[0], wantScheduled) || !reflect.DeepEqual(dateAlternatives[1], wantDue) {
		t.Fatalf("Kolkata date bounds = %#v, want [%s, %s)", dateAlternatives, midnight, nextMidnight)
	}
	wantOverdue := bson.M{"$or": bson.A{
		bson.M{"scheduledDate": bson.M{"$lt": midnight}},
		bson.M{"dueDate": bson.M{"$lt": midnight}},
	}}
	if !reflect.DeepEqual(clauses[3], wantOverdue) {
		t.Fatalf("Kolkata overdue boundary = %#v, want %#v", clauses[3], wantOverdue)
	}
}

func TestBuildTodoListQueryUsesProfileTimezoneFallback(t *testing.T) {
	userID := primitive.NewObjectID()
	query, err := buildTodoListQuery(userID, "2026-08-08", "", "", "", "", "", "Asia/Kolkata", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	start := query.filter["$and"].(bson.A)[1].(bson.M)["$or"].(bson.A)[0].(bson.M)["scheduledDate"].(bson.M)["$gte"]
	want := time.Date(2026, time.August, 7, 18, 30, 0, 0, time.UTC)
	if !reflect.DeepEqual(start, want) {
		t.Fatalf("profile timezone start = %#v, want %v", start, want)
	}
}

func TestBuildTodoListQueryOverdueUsesStartOfToday(t *testing.T) {
	userID := primitive.NewObjectID()
	now := time.Date(2026, time.August, 6, 22, 45, 0, 0, time.UTC)
	query, err := buildTodoListQuery(userID, "", "true", "", "", "", "UTC", "", now)
	if err != nil {
		t.Fatalf("buildTodoListQuery returned error: %v", err)
	}

	clauses := query.filter["$and"].(bson.A)
	if len(clauses) != 3 {
		t.Fatalf("got %d clauses, want user + incomplete + overdue", len(clauses))
	}
	if !reflect.DeepEqual(clauses[1], bson.M{"completed": false}) {
		t.Fatalf("overdue must force incomplete tasks, got %#v", clauses[1])
	}

	start := time.Date(2026, time.August, 6, 0, 0, 0, 0, time.UTC)
	want := bson.M{"$or": bson.A{
		bson.M{"scheduledDate": bson.M{"$lt": start}},
		bson.M{"dueDate": bson.M{"$lt": start}},
	}}
	if !reflect.DeepEqual(clauses[2], want) {
		t.Fatalf("overdue clause = %#v, want %#v", clauses[2], want)
	}
}

func TestBuildTodoListQueryRejectsInvalidValues(t *testing.T) {
	userID := primitive.NewObjectID()
	now := time.Now()
	tests := []struct {
		name, date, overdue, completed, limit, offset, timezone, contains string
	}{
		{name: "date", date: "06-08-2026", contains: "YYYY-MM-DD"},
		{name: "overdue", overdue: "sometimes", contains: "overdue"},
		{name: "completed", completed: "done", contains: "completed"},
		{name: "zero limit", limit: "0", contains: "limit"},
		{name: "large limit", limit: "501", contains: "limit"},
		{name: "negative offset", offset: "-1", contains: "offset"},
		{name: "large offset", offset: "10001", contains: "offset"},
		{name: "timezone", timezone: "Mars/Olympus", contains: "timezone"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := buildTodoListQuery(userID, test.date, test.overdue, test.completed, test.limit, test.offset, test.timezone, "", now)
			if err == nil || !strings.Contains(err.Error(), test.contains) {
				t.Fatalf("error = %v, want error containing %q", err, test.contains)
			}
		})
	}
}
