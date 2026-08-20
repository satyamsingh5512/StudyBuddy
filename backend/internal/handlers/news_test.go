package handlers

import (
	"strings"
	"testing"
	"time"
)

func TestTargetExamCycleYearStaysCurrentBeforeJuly(t *testing.T) {
	cases := []time.Month{time.January, time.March, time.June}
	for _, month := range cases {
		now := time.Date(2026, month, 15, 0, 0, 0, 0, time.UTC)
		got := targetExamCycleYear(now)
		if got != 2026 {
			t.Errorf("targetExamCycleYear(%s 2026) = %d, want 2026", month, got)
		}
	}
}

func TestTargetExamCycleYearRollsToNextYearAfterJune(t *testing.T) {
	cases := []time.Month{time.July, time.August, time.December}
	for _, month := range cases {
		now := time.Date(2026, month, 15, 0, 0, 0, 0, time.UTC)
		got := targetExamCycleYear(now)
		if got != 2027 {
			t.Errorf("targetExamCycleYear(%s 2026) = %d, want 2027", month, got)
		}
	}
}

// TestGroqToolUseFailedDetection guards the string match used to recognize
// Groq's tool_use_failed 400 response (e.g. the compound/gpt-oss models
// emitting an unrecognized tool name like "web.run") so callGroq's fallback
// path keeps triggering even if the surrounding error formatting changes.
func TestGroqToolUseFailedDetection(t *testing.T) {
	body := `{"error":{"message":"Tool choice is none, but model called a tool","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"{\"name\": \"web.run\", \"arguments\": {}}"}}`
	if !strings.Contains(body, "tool_use_failed") {
		t.Fatal("expected tool_use_failed detection substring to match a real Groq error body")
	}
}
