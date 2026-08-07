package handlers

import (
	"fmt"
	"math"
	"strings"
	"time"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func reportLocation(c *fiber.Ctx, user models.User, bodyTimezone string) (*time.Location, error) {
	explicit := strings.TrimSpace(bodyTimezone)
	if explicit == "" {
		explicit = strings.TrimSpace(c.Query("timezone"))
	}
	if explicit == "" {
		explicit = strings.TrimSpace(c.Get("X-Timezone"))
	}
	if explicit != "" {
		location, err := time.LoadLocation(explicit)
		if err != nil {
			return nil, fmt.Errorf("timezone must be a valid IANA timezone")
		}
		return location, nil
	}
	if location, ok := loadGoalLocation(user.Timezone); ok {
		return location, nil
	}
	return time.UTC, nil
}

func parseReportDate(value string, location *time.Location, now time.Time) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return localGoalDay(now, location).UTC(), nil
	}
	if date, err := parseDateOnlyInLocation(value, location); err == nil {
		return date.UTC(), nil
	}
	instant, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("date must be YYYY-MM-DD or RFC3339")
	}
	return localGoalDay(instant, location).UTC(), nil
}

func validateReportRequest(req CreateReportRequest) error {
	floats := map[string]float64{
		"studyHours": req.StudyHours, "hoursLogged": req.HoursLogged,
		"understanding": req.Understanding, "completionPct": req.CompletionPct,
	}
	for name, value := range floats {
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return fmt.Errorf("%s must be a finite non-negative number", name)
		}
	}
	if req.StudyHours > 24 || req.HoursLogged > 24 {
		return fmt.Errorf("study hours cannot exceed 24")
	}
	if req.Understanding > 100 {
		return fmt.Errorf("understanding cannot exceed 100")
	}
	if req.CompletionPct > 100 {
		return fmt.Errorf("completionPct cannot exceed 100")
	}
	counts := map[string]int{
		"tasksPlanned": req.TasksPlanned, "tasksCompleted": req.TasksCompleted,
		"questionsPlanned": req.QuestionsPlanned, "questionsCompleted": req.QuestionsCompleted,
		"questionsEasy": req.QuestionsEasy, "questionsMedium": req.QuestionsMedium,
		"questionsHard": req.QuestionsHard, "pointsEarned": req.PointsEarned,
	}
	for name, value := range counts {
		if value < 0 {
			return fmt.Errorf("%s must be non-negative", name)
		}
	}
	if req.TasksCompleted > req.TasksPlanned {
		return fmt.Errorf("tasksCompleted cannot exceed tasksPlanned")
	}
	if req.QuestionsCompleted > req.QuestionsPlanned {
		return fmt.Errorf("questionsCompleted cannot exceed questionsPlanned")
	}
	if len([]rune(req.Notes)) > 5000 {
		return fmt.Errorf("notes cannot exceed 5000 characters")
	}
	return nil
}
