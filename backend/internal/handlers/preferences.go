package handlers

import (
	"fmt"
	"regexp"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
)

type dashboardPreferencesPatch struct {
	Order  *[]string `json:"order"`
	Hidden *[]string `json:"hidden"`
}

type showUpReminderPatch struct {
	Enabled *bool   `json:"enabled"`
	Time    *string `json:"time"`
	Days    *[]int  `json:"days"`
}

type userPreferencesPatch struct {
	Font                 *string                    `json:"font"`
	Accent               *string                    `json:"accent"`
	Dashboard            *dashboardPreferencesPatch `json:"dashboard"`
	ShowUpReminder       *showUpReminderPatch       `json:"showUpReminder"`
	MentorJournalContext *bool                      `json:"mentorJournalContext"`
}

var allowedPreferenceAccents = func() map[string]struct{} {
	allowed := make(map[string]struct{}, len(models.PreferenceAccentIDs))
	for _, accent := range models.PreferenceAccentIDs {
		allowed[accent] = struct{}{}
	}
	return allowed
}()

var reminderTimePattern = regexp.MustCompile(`^(?:[01][0-9]|2[0-3]):[0-5][0-9]$`)

func validateUniqueDashboardIDs(values []string, field string) error {
	allowed := make(map[string]struct{}, len(models.DashboardWidgetIDs))
	for _, id := range models.DashboardWidgetIDs {
		allowed[id] = struct{}{}
	}
	seen := make(map[string]struct{}, len(values))
	for _, id := range values {
		if _, ok := allowed[id]; !ok {
			return fmt.Errorf("%s contains an unknown dashboard ID", field)
		}
		if _, duplicate := seen[id]; duplicate {
			return fmt.Errorf("%s must contain unique dashboard IDs", field)
		}
		seen[id] = struct{}{}
	}
	return nil
}

func applyPreferencesPatch(patch *userPreferencesPatch, update bson.M) error {
	if patch == nil {
		return nil
	}
	if patch.Font != nil {
		if *patch.Font != models.PreferenceFontSans && *patch.Font != models.PreferenceFontMono && *patch.Font != models.PreferenceFontSerif {
			return fmt.Errorf("preferences.font must be sans, mono, or serif")
		}
		update["preferences.font"] = *patch.Font
	}
	if patch.Accent != nil {
		if _, ok := allowedPreferenceAccents[*patch.Accent]; !ok {
			return fmt.Errorf("preferences.accent is not supported")
		}
		update["preferences.accent"] = *patch.Accent
	}
	if patch.Dashboard != nil {
		if patch.Dashboard.Order != nil {
			if err := validateUniqueDashboardIDs(*patch.Dashboard.Order, "preferences.dashboard.order"); err != nil {
				return err
			}
			update["preferences.dashboard.order"] = *patch.Dashboard.Order
		}
		if patch.Dashboard.Hidden != nil {
			if err := validateUniqueDashboardIDs(*patch.Dashboard.Hidden, "preferences.dashboard.hidden"); err != nil {
				return err
			}
			update["preferences.dashboard.hidden"] = *patch.Dashboard.Hidden
		}
	}
	if patch.ShowUpReminder != nil {
		if patch.ShowUpReminder.Enabled != nil {
			update["preferences.showUpReminder.enabled"] = *patch.ShowUpReminder.Enabled
		}
		if patch.ShowUpReminder.Time != nil {
			if !reminderTimePattern.MatchString(*patch.ShowUpReminder.Time) {
				return fmt.Errorf("preferences.showUpReminder.time must use HH:MM")
			}
			update["preferences.showUpReminder.time"] = *patch.ShowUpReminder.Time
		}
		if patch.ShowUpReminder.Days != nil {
			seen := map[int]struct{}{}
			for _, day := range *patch.ShowUpReminder.Days {
				if day < 0 || day > 6 {
					return fmt.Errorf("preferences.showUpReminder.days must be between 0 and 6")
				}
				if _, duplicate := seen[day]; duplicate {
					return fmt.Errorf("preferences.showUpReminder.days must be unique")
				}
				seen[day] = struct{}{}
			}
			update["preferences.showUpReminder.days"] = *patch.ShowUpReminder.Days
		}
	}
	if patch.MentorJournalContext != nil {
		update["preferences.mentorJournalContext"] = *patch.MentorJournalContext
	}
	return nil
}
