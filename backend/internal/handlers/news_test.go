package handlers

import (
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
