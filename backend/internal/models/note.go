package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Note represents a free-form notepad entry that a user can store, highlight
// with a color, tag, pin and search through. Notes are grouped date-wise on
// the frontend using CreatedAt.
type Note struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Title     string             `bson:"title,omitempty" json:"title"`
	Content   string             `bson:"content" json:"content"`
	// Color is a highlight color label (e.g. "yellow", "green", "blue").
	Color     string   `bson:"color,omitempty" json:"color"`
	Tags      []string `bson:"tags,omitempty" json:"tags"`
	Pinned    bool     `bson:"pinned" json:"pinned"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time `bson:"updatedAt" json:"updatedAt"`
}
