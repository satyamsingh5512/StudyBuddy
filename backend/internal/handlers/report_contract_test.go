package handlers

import (
	"encoding/json"
	"testing"
	"time"
)

func TestLegacyReportFieldsRoundTrip(t *testing.T) {
	req := CreateReportRequest{QuestionsEasy: 3, QuestionsMedium: 4, QuestionsHard: 5, StudyHours: 2.5}
	normalizeLegacyReportRequest(&req)
	if req.QuestionsCompleted != 12 || req.QuestionsPlanned != 12 || req.HoursLogged != 2.5 {
		t.Fatalf("normalized request=%#v", req)
	}
	report := Report{QuestionsEasy: req.QuestionsEasy, QuestionsMedium: req.QuestionsMedium, QuestionsHard: req.QuestionsHard, QuestionsPlanned: req.QuestionsPlanned, QuestionsCompleted: req.QuestionsCompleted, StudyHours: req.StudyHours, HoursLogged: req.HoursLogged}
	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Report
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.QuestionsEasy != 3 || decoded.QuestionsMedium != 4 || decoded.QuestionsHard != 5 || decoded.QuestionsCompleted != 12 || decoded.HoursLogged != 2.5 {
		t.Fatalf("round trip=%#v", decoded)
	}
}

func TestReportDatePreservesLocalCalendarDayAcrossDST(t *testing.T) {
	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	for _, date := range []string{"2026-03-08", "2026-11-01"} {
		parsed, err := parseReportDate(date, location, time.Time{})
		if err != nil {
			t.Fatalf("%s: %v", date, err)
		}
		if got := parsed.In(location).Format("2006-01-02 15:04"); got != date+" 00:00" {
			t.Fatalf("%s became %s", date, got)
		}
	}
	instant, err := parseReportDate("2026-03-09T03:30:00Z", location, time.Time{})
	if err != nil || instant.In(location).Format("2006-01-02") != "2026-03-08" {
		t.Fatalf("RFC3339 local date=%v err=%v", instant.In(location), err)
	}
}
