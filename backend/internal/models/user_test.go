package models

import (
	"reflect"
	"testing"
)

func TestNormalizeUserPreferencesDefaultsAndPreservesExplicitLists(t *testing.T) {
	var user User
	NormalizeUserPreferences(&user)
	if user.Preferences.Font != PreferenceFontSans || user.Preferences.Accent != "blue" {
		t.Fatalf("defaults = %#v", user.Preferences)
	}
	if user.Preferences.Dashboard.Order == nil || user.Preferences.Dashboard.Hidden == nil || user.Preferences.ShowUpReminder.Days == nil {
		t.Fatal("list defaults must be non-nil")
	}
	empty := []string{}
	user = User{Preferences: UserPreferences{Dashboard: DashboardPreferences{Order: empty}}}
	NormalizeUserPreferences(&user)
	if len(user.Preferences.Dashboard.Order) != 0 {
		t.Fatal("explicit empty order was overwritten")
	}
}

func TestPreferenceAllowlistsAreFiniteAndIndependent(t *testing.T) {
	wantAccents := []string{"blue", "violet", "teal", "green", "orange", "rose", "purple", "indigo", "cyan", "lime", "yellow", "amber", "red", "pink"}
	if !reflect.DeepEqual(PreferenceAccentIDs, wantAccents) {
		t.Fatalf("accent IDs = %#v", PreferenceAccentIDs)
	}
	wantWidgets := []string{"overview", "goals", "schedule", "leaderboard", "daily-summary", "weekly-check-in", "achievements", "quick-show-up"}
	if !reflect.DeepEqual(DashboardWidgetIDs, wantWidgets) {
		t.Fatalf("dashboard widget IDs = %#v", DashboardWidgetIDs)
	}
}
