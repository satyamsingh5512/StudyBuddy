package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Todo struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Title     string             `bson:"title" json:"title"`
	Subject   string             `bson:"subject,omitempty" json:"subject,omitempty"`
	Difficulty string            `bson:"difficulty,omitempty" json:"difficulty,omitempty"`
	QuestionsTarget int          `bson:"questionsTarget,omitempty" json:"questionsTarget,omitempty"`
	Completed bool               `bson:"completed" json:"completed"`
	ScheduledDate *time.Time     `bson:"scheduledDate,omitempty" json:"scheduledDate,omitempty"`
	OriginalScheduledDate *time.Time `bson:"originalScheduledDate,omitempty" json:"originalScheduledDate,omitempty"`
	RescheduledCount int         `bson:"rescheduledCount,omitempty" json:"rescheduledCount,omitempty"`
	DueDate   *time.Time         `bson:"dueDate,omitempty" json:"dueDate,omitempty"`
	// Schedule integration — set when a todo is generated from an AI schedule.
	Source    string             `bson:"source,omitempty" json:"source,omitempty"`       // "schedule" | "" (manual)
	StartTime string             `bson:"startTime,omitempty" json:"startTime,omitempty"` // "08:00"
	EndTime   string             `bson:"endTime,omitempty" json:"endTime,omitempty"`     // "09:00"
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}
