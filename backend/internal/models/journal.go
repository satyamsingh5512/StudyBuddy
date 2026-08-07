package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JournalEntry is one revisioned Markdown document per owner and local date.
type JournalEntry struct {
	ID            primitive.ObjectID   `bson:"_id,omitempty" json:"id,omitempty"`
	UserID        primitive.ObjectID   `bson:"userId" json:"-"`
	Date          string               `bson:"date" json:"date"`
	Markdown      string               `bson:"markdown" json:"markdown"`
	Revision      int64                `bson:"revision" json:"revision"`
	AttachmentIDs []primitive.ObjectID `bson:"attachmentIds" json:"attachmentIds"`
	MutationToken string               `bson:"mutationToken,omitempty" json:"-"`
	CreatedAt     time.Time            `bson:"createdAt" json:"createdAt,omitempty"`
	UpdatedAt     time.Time            `bson:"updatedAt" json:"updatedAt,omitempty"`
}

type JournalAttachmentClaim struct {
	Token     string    `bson:"token"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

// JournalAttachment stores small private images independently from entries.
// Bytes remain present while DeletionState is set, so an interrupted delete is
// recoverable and can never strand a committed journal reference.
type JournalAttachment struct {
	ID              primitive.ObjectID       `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID       `bson:"userId" json:"-"`
	MIME            string                   `bson:"mime" json:"mime"`
	Size            int64                    `bson:"size" json:"size"`
	Slot            int                      `bson:"slot" json:"-"`
	Data            []byte                   `bson:"data" json:"-"`
	DeletionState   string                   `bson:"deletionState,omitempty" json:"-"`
	DeletionToken   string                   `bson:"deletionToken,omitempty" json:"-"`
	ReferenceClaims []JournalAttachmentClaim `bson:"referenceClaims,omitempty" json:"-"`
	CreatedAt       time.Time                `bson:"createdAt" json:"createdAt"`
}
