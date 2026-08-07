package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	GoalStatusActive    = "active"
	GoalStatusCompleted = "completed"
	GoalStatusArchived  = "archived"

	GoalGridDaily  = "daily"
	GoalGridWeekly = "weekly"

	GoalCompletionAuto   = "auto"
	GoalCompletionManual = "manual"

	GoalActivityComplete = "complete"
	GoalActivityPartial  = "partial"

	GoalSourceManual    = "manual"
	GoalSourceAutomatic = "automatic"
)

// SubGoal is an ordered, bounded part of a goal definition. Daily completion
// history is stored separately in goal_completions.
type SubGoal struct {
	ID          primitive.ObjectID `bson:"_id" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Position    int                `bson:"position" json:"position"`
	Completed   bool               `bson:"completed" json:"completed"`
	CompletedAt *time.Time         `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
}

// Milestone is an ordered checkpoint within a goal timeline.
type Milestone struct {
	ID          primitive.ObjectID `bson:"_id" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Position    int                `bson:"position" json:"position"`
	TargetDate  *string            `bson:"targetDate,omitempty" json:"targetDate,omitempty"`
	Completed   bool               `bson:"completed" json:"completed"`
	CompletedAt *time.Time         `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
}

// Goal contains bounded configuration. High-growth calendar activity lives in
// separate owner-scoped collections.
type Goal struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"userId" json:"-"`
	DefinitionVersion int64              `bson:"definitionVersion" json:"definitionVersion"`
	Title             string             `bson:"title" json:"title"`
	Description       string             `bson:"description,omitempty" json:"description,omitempty"`
	Status            string             `bson:"status" json:"status"`
	GridMode          string             `bson:"gridMode" json:"gridMode"`
	CompletionPolicy  string             `bson:"completionPolicy" json:"completionPolicy"`
	StartDate         string             `bson:"startDate" json:"startDate"`
	TargetDate        *string            `bson:"targetDate,omitempty" json:"targetDate,omitempty"`
	SubGoals          []SubGoal          `bson:"subGoals" json:"subGoals"`
	Milestones        []Milestone        `bson:"milestones" json:"milestones"`
	CompletedAt       *time.Time         `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
	ArchivedAt        *time.Time         `bson:"archivedAt,omitempty" json:"archivedAt,omitempty"`
	DeleteState       string             `bson:"deleteState,omitempty" json:"-"`
	DeleteToken       string             `bson:"deleteToken,omitempty" json:"-"`
	DeletingAt        *time.Time         `bson:"deletingAt,omitempty" json:"-"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// GoalCompletion is an idempotent sub-goal activity entry for a calendar date.
type GoalCompletion struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"userId" json:"-"`
	GoalID            primitive.ObjectID `bson:"goalId" json:"goalId"`
	SubGoalID         primitive.ObjectID `bson:"subGoalId" json:"subGoalId"`
	DefinitionVersion int64              `bson:"definitionVersion" json:"definitionVersion"`
	Date              string             `bson:"date" json:"date"`
	Status            string             `bson:"status" json:"status"`
	Source            string             `bson:"source" json:"source"`
	Note              string             `bson:"note,omitempty" json:"note,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// ShowUp explicitly records whether a user showed up for a goal period.
type ShowUp struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"userId" json:"-"`
	GoalID            primitive.ObjectID `bson:"goalId" json:"goalId"`
	DefinitionVersion int64              `bson:"definitionVersion,omitempty" json:"definitionVersion,omitempty"`
	Date              string             `bson:"date" json:"date"`
	Status            string             `bson:"status" json:"status"`
	Source            string             `bson:"source" json:"source"`
	Note              string             `bson:"note,omitempty" json:"note,omitempty"`
	MutationToken     string             `bson:"mutationToken,omitempty" json:"-"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// GoalCheckIn captures the user's target and reflection for a Monday-based week.
type GoalCheckIn struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         primitive.ObjectID `bson:"userId" json:"-"`
	GoalID         primitive.ObjectID `bson:"goalId" json:"goalId"`
	WeekStart      string             `bson:"weekStart" json:"weekStart"`
	TargetMomentum int                `bson:"targetMomentum" json:"targetMomentum"`
	Reflection     string             `bson:"reflection,omitempty" json:"reflection,omitempty"`
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt" json:"updatedAt"`
}
