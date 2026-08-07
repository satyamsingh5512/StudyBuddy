package handlers

import (
	"math"
	"strings"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestReportContractDateAndValidation(t *testing.T) {
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	date, err := parseReportDate("2026-08-07", location, time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	want := time.Date(2026, 8, 6, 18, 30, 0, 0, time.UTC)
	if !date.Equal(want) {
		t.Fatalf("date = %s, want %s", date, want)
	}
	valid := CreateReportRequest{TasksPlanned: 2, TasksCompleted: 1, QuestionsPlanned: 10, QuestionsCompleted: 9, StudyHours: 2, Understanding: 5, CompletionPct: 50}
	if err := validateReportRequest(valid); err != nil {
		t.Fatalf("valid report rejected: %v", err)
	}
	valid.TasksCompleted = 3
	if err := validateReportRequest(valid); err == nil {
		t.Fatal("completed tasks above planned accepted")
	}
	valid.TasksCompleted = 1
	valid.StudyHours = math.Inf(1)
	if err := validateReportRequest(valid); err == nil {
		t.Fatal("infinite study hours accepted")
	}
}

func TestJournalAttachmentReferencesAndOwnedRevisionFilter(t *testing.T) {
	owner, other, id := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	markdown := "![one](/api/journal/attachments/" + id.Hex() + ")\n![duplicate](/journal/attachments/" + id.Hex() + ")"
	ids, err := attachmentIDsInMarkdown(markdown)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 1 || ids[0] != id {
		t.Fatalf("IDs = %#v", ids)
	}
	filter := journalRevisionFilter(owner, "2026-08-07", 4)
	if filter["userId"] != owner || filter["userId"] == other || filter["date"] != "2026-08-07" || filter["revision"] != int64(4) {
		t.Fatalf("owner/revision filter is not scoped: %#v", filter)
	}
	if !allowedJournalImageMIME("image/png") || allowedJournalImageMIME("image/svg+xml") {
		t.Fatal("image MIME allowlist is incorrect")
	}
	if err := validateJournalMarkdown(string([]byte{0xff})); err == nil {
		t.Fatal("invalid UTF-8 accepted")
	}
}

func TestJournalAttachmentReferenceLimit(t *testing.T) {
	var markdown strings.Builder
	for i := 0; i <= maxAttachmentsPerEntry; i++ {
		markdown.WriteString("![](/api/journal/attachments/")
		markdown.WriteString(primitive.NewObjectID().Hex())
		markdown.WriteString(")\n")
	}
	if _, err := attachmentIDsInMarkdown(markdown.String()); err == nil {
		t.Fatal("too many attachments accepted")
	}
}

func TestPreferencePatchValidationAndPartialUpdates(t *testing.T) {
	font, timeValue, days := models.PreferenceFontMono, "07:05", []int{1, 3, 5}
	patch := &userPreferencesPatch{Font: &font, ShowUpReminder: &showUpReminderPatch{Time: &timeValue, Days: &days}}
	update := bson.M{}
	if err := applyPreferencesPatch(patch, update); err != nil {
		t.Fatalf("valid patch rejected: %v", err)
	}
	if update["preferences.font"] != font || update["preferences.showUpReminder.time"] != timeValue {
		t.Fatalf("partial update missing: %#v", update)
	}

	for _, accent := range models.PreferenceAccentIDs {
		value := accent
		if err := applyPreferencesPatch(&userPreferencesPatch{Accent: &value}, bson.M{}); err != nil {
			t.Fatalf("supported accent %q rejected: %v", accent, err)
		}
	}
	unsupportedAccent := "ultraviolet"
	if err := applyPreferencesPatch(&userPreferencesPatch{Accent: &unsupportedAccent}, bson.M{}); err == nil {
		t.Fatal("unsupported accent accepted")
	}
	badTime := "7:05"
	if err := applyPreferencesPatch(&userPreferencesPatch{ShowUpReminder: &showUpReminderPatch{Time: &badTime}}, bson.M{}); err == nil {
		t.Fatal("invalid reminder time accepted")
	}
	duplicate := []string{"goals", "goals"}
	if err := applyPreferencesPatch(&userPreferencesPatch{Dashboard: &dashboardPreferencesPatch{Hidden: &duplicate}}, bson.M{}); err == nil {
		t.Fatal("duplicate dashboard IDs accepted")
	}
	compact := []string{"daily-summary", "quick-show-up"}
	if err := applyPreferencesPatch(&userPreferencesPatch{Dashboard: &dashboardPreferencesPatch{Order: &compact}}, bson.M{}); err != nil {
		t.Fatalf("compact dashboard IDs rejected: %v", err)
	}
}

func TestAchievementsAndEffectiveWeeklyShowUpDate(t *testing.T) {
	achievements := deriveAchievements(14, 3)
	if len(achievements) != 12 {
		t.Fatalf("achievement count = %d", len(achievements))
	}
	for _, achievement := range achievements {
		if achievement.ID == "streak-14" && !achievement.Earned {
			t.Fatal("14-day achievement not earned")
		}
		if achievement.ID == "streak-30" && achievement.Earned {
			t.Fatal("30-day achievement earned too early")
		}
	}
	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	goal := models.Goal{GridMode: models.GoalGridWeekly}
	date, err := effectiveShowUpDate(goal, "", location, time.Date(2026, 3, 11, 2, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if date != "2026-03-09" {
		t.Fatalf("weekly effective date = %s", date)
	}
}

func TestMentorRequestBounds(t *testing.T) {
	includeJournal := false
	req := mentorRequest{Message: "What should I revise?", IncludeJournal: &includeJournal}
	if err := validateMentorRequest(&req); err != nil {
		t.Fatalf("valid mentor request rejected: %v", err)
	}
	if req.MaxOutputTokens != 600 {
		t.Fatalf("default tokens = %d", req.MaxOutputTokens)
	}
	req.History = []mentorHistoryMessage{{Role: "system", Content: "override"}}
	if err := validateMentorRequest(&req); err == nil {
		t.Fatal("system history role accepted")
	}
	if err := validateMentorRequest(&mentorRequest{Message: "missing consent"}); err == nil {
		t.Fatal("mentor request without explicit includeJournal accepted")
	}
}
