package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	PreferenceFontSans  = "sans"
	PreferenceFontMono  = "mono"
	PreferenceFontSerif = "serif"
)

var PreferenceAccentIDs = []string{"blue", "violet", "teal", "green", "orange", "rose", "purple", "indigo", "cyan", "lime", "yellow", "amber", "red", "pink"}

// DashboardWidgetIDs contains only independently renderable/reorderable sections.
// The floating timer and the combined task/activity workspace are fixed features.
var DashboardWidgetIDs = []string{"overview", "goals", "schedule", "leaderboard", "daily-summary", "weekly-check-in", "achievements", "quick-show-up"}

type DashboardPreferences struct {
	Order  []string `bson:"order" json:"order"`
	Hidden []string `bson:"hidden" json:"hidden"`
}

type ShowUpReminderPreferences struct {
	Enabled bool   `bson:"enabled" json:"enabled"`
	Time    string `bson:"time" json:"time"`
	Days    []int  `bson:"days" json:"days"`
}

type UserPreferences struct {
	Font                 string                    `bson:"font" json:"font"`
	Accent               string                    `bson:"accent" json:"accent"`
	Dashboard            DashboardPreferences      `bson:"dashboard" json:"dashboard"`
	ShowUpReminder       ShowUpReminderPreferences `bson:"showUpReminder" json:"showUpReminder"`
	MentorJournalContext bool                      `bson:"mentorJournalContext" json:"mentorJournalContext"`
}

func DefaultUserPreferences() UserPreferences {
	order := append([]string(nil), DashboardWidgetIDs...)
	return UserPreferences{
		Font:           PreferenceFontSans,
		Accent:         "blue",
		Dashboard:      DashboardPreferences{Order: order, Hidden: []string{}},
		ShowUpReminder: ShowUpReminderPreferences{Time: "20:00", Days: []int{}},
	}
}

// NormalizeUserPreferences supplies additive defaults for documents created
// before preferences existed while preserving explicitly stored empty lists.
func NormalizeUserPreferences(user *User) {
	defaults := DefaultUserPreferences()
	if user.Preferences.Font == "" {
		user.Preferences.Font = defaults.Font
	}
	if user.Preferences.Accent == "" {
		user.Preferences.Accent = defaults.Accent
	}
	if user.Preferences.Dashboard.Order == nil {
		user.Preferences.Dashboard.Order = defaults.Dashboard.Order
	}
	if user.Preferences.Dashboard.Hidden == nil {
		user.Preferences.Dashboard.Hidden = []string{}
	}
	if user.Preferences.ShowUpReminder.Time == "" {
		user.Preferences.ShowUpReminder.Time = defaults.ShowUpReminder.Time
	}
	if user.Preferences.ShowUpReminder.Days == nil {
		user.Preferences.ShowUpReminder.Days = []int{}
	}
}

type User struct {
	ID                   primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email                string             `bson:"email" json:"email"`
	Password             string             `bson:"password" json:"-"`
	Name                 string             `bson:"name" json:"name"`
	Username             string             `bson:"username" json:"username"`
	Avatar               string             `bson:"avatar,omitempty" json:"avatar,omitempty"`
	AvatarType           string             `bson:"avatarType,omitempty" json:"avatarType,omitempty"`
	Role                 string             `bson:"role" json:"role"`
	EmailVerified        bool               `bson:"emailVerified" json:"emailVerified"`
	VerificationOtp      string             `bson:"verificationOtp,omitempty" json:"-"`
	OtpExpiry            time.Time          `bson:"otpExpiry,omitempty" json:"-"`
	ResetToken           string             `bson:"resetToken,omitempty" json:"-"`
	ResetTokenExpiry     time.Time          `bson:"resetTokenExpiry,omitempty" json:"-"`
	FailedLoginAttempts  int                `bson:"failedLoginAttempts,omitempty" json:"-"`
	LoginLockedUntil     *time.Time         `bson:"loginLockedUntil,omitempty" json:"-"`
	VerificationAttempts int                `bson:"verificationAttempts,omitempty" json:"-"`
	ResetAttempts        int                `bson:"resetAttempts,omitempty" json:"-"`
	SessionVersion       int                `bson:"sessionVersion,omitempty" json:"-"`
	OnboardingDone       bool               `bson:"onboardingDone" json:"onboardingDone"`
	TotalPoints          int                `bson:"totalPoints" json:"totalPoints"`
	TotalStudyMins       int                `bson:"totalStudyMinutes" json:"totalStudyMinutes"`
	Streak               int                `bson:"streak" json:"streak"`
	BestStreak           int                `bson:"bestStreak,omitempty" json:"bestStreak"`
	Preferences          UserPreferences    `bson:"preferences,omitempty" json:"preferences"`
	LastStudyAt          *time.Time         `bson:"lastStudyAt,omitempty" json:"lastStudyAt,omitempty"`
	StatsResetAt         *time.Time         `bson:"statsResetAt,omitempty" json:"statsResetAt,omitempty"`
	StatsResetAppliedAt  *time.Time         `bson:"statsResetAppliedAt,omitempty" json:"statsResetAppliedAt,omitempty"`
	Timezone             string             `bson:"timezone,omitempty" json:"timezone,omitempty"`
	ExamGoal             string             `bson:"examGoal,omitempty" json:"examGoal,omitempty"`
	ExamDate             *time.Time         `bson:"examDate,omitempty" json:"examDate,omitempty"`
	StudentClass         string             `bson:"studentClass,omitempty" json:"studentClass,omitempty"`
	Batch                string             `bson:"batch,omitempty" json:"batch,omitempty"`
	Syllabus             string             `bson:"syllabus,omitempty" json:"syllabus,omitempty"`
	Subjects             []string           `bson:"subjects,omitempty" json:"subjects,omitempty"`
	CreatedAt            time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt            time.Time          `bson:"updatedAt" json:"updatedAt"`
	LastActive           time.Time          `bson:"lastActive" json:"lastActive"`
	ShowProfile          bool               `bson:"showProfile" json:"showProfile"`
}
