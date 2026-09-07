package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FocusSession tracks one live focus timer per user for cross-device guard.
// Only one document per user is active at a time; heartbeats keep it alive
// and stale heartbeats (>90s) are treated as expired by readers.
type FocusSession struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID `bson:"userId" json:"userId"`
	DeviceID        string             `bson:"deviceId" json:"deviceId"`
	Subject         string             `bson:"subject,omitempty" json:"subject,omitempty"`
	DurationMinutes int                `bson:"durationMinutes,omitempty" json:"durationMinutes,omitempty"`
	StartedAt       time.Time          `bson:"startedAt" json:"startedAt"`
	HeartbeatAt     time.Time          `bson:"heartbeatAt" json:"heartbeatAt"`
	Active          bool               `bson:"active" json:"active"`
	EndReason       string             `bson:"endReason,omitempty" json:"endReason,omitempty"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}
