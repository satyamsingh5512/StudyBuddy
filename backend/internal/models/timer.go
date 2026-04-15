package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Session struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Duration  int                `bson:"duration" json:"duration"` // in minutes
	Subject   string             `bson:"subject" json:"subject"`
	StartTime time.Time          `bson:"startTime" json:"startTime"`
	EndTime   time.Time          `bson:"endTime" json:"endTime"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}
