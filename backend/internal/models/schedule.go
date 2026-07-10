package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TimeBlock represents a free or blocked window in a day.
type TimeBlock struct {
	DayOfWeek int    `bson:"dayOfWeek" json:"dayOfWeek"` // 0=Sun … 6=Sat
	StartTime string `bson:"startTime" json:"startTime"` // "08:00"
	EndTime   string `bson:"endTime" json:"endTime"`     // "10:00"
	Label     string `bson:"label,omitempty" json:"label,omitempty"`
}

// Availability stores the user's weekly availability blueprint.
type Availability struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	FreeBlocks  []TimeBlock        `bson:"freeBlocks" json:"freeBlocks"`
	BlockedSlots []TimeBlock       `bson:"blockedSlots" json:"blockedSlots"`
	WakeTime    string             `bson:"wakeTime,omitempty" json:"wakeTime,omitempty"`   // "06:00"
	SleepTime   string             `bson:"sleepTime,omitempty" json:"sleepTime,omitempty"` // "23:00"
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// ScheduleItem is a single Gemini-generated task block.
type ScheduleItem struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TaskTitle   string             `bson:"taskTitle" json:"taskTitle"`
	Subject     string             `bson:"subject,omitempty" json:"subject,omitempty"`
	Description string             `bson:"description,omitempty" json:"description,omitempty"`
	StartTime   string             `bson:"startTime" json:"startTime"` // "08:00"
	EndTime     string             `bson:"endTime" json:"endTime"`     // "09:00"
	Date        string             `bson:"date" json:"date"`           // "2026-07-10"
	Priority    string             `bson:"priority,omitempty" json:"priority,omitempty"` // low | medium | high
	Completed   bool               `bson:"completed" json:"completed"`
	AlarmFired  bool               `bson:"alarmFired" json:"alarmFired"`
	PointsAwarded int              `bson:"pointsAwarded,omitempty" json:"pointsAwarded,omitempty"`
}

// Schedule is the AI-generated plan for a user on a specific date (or range).
type Schedule struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	GeneratedAt time.Time          `bson:"generatedAt" json:"generatedAt"`
	Prompt      string             `bson:"prompt" json:"prompt"`
	Items       []ScheduleItem     `bson:"items" json:"items"`
	Date        string             `bson:"date" json:"date"` // "2026-07-10" (primary date)
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}
