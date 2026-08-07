package handlers

import (
	"context"
	"errors"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type mutableJournalStore struct {
	owner         primitive.ObjectID
	attachmentID  primitive.ObjectID
	available     bool
	deleting      bool
	deleteToken   string
	claimToken    string
	entry         *models.JournalEntry
	references    int64
	onSave        func(*mutableJournalStore)
	onCompensate  func(*mutableJournalStore)
	rollbackCalls int
}

func (s *mutableJournalStore) AcquireAttachmentClaims(_ context.Context, userID primitive.ObjectID, ids []primitive.ObjectID, token string, _ time.Time) error {
	for _, id := range ids {
		if userID != s.owner || id != s.attachmentID || !s.available || s.deleting {
			return errJournalAttachmentUnavailable
		}
	}
	if len(ids) > 0 {
		s.claimToken = token
	}
	return nil
}

func (s *mutableJournalStore) ReleaseAttachmentClaims(_ context.Context, _ primitive.ObjectID, _ []primitive.ObjectID, token string) error {
	if s.claimToken == token {
		s.claimToken = ""
	}
	return nil
}

func (s *mutableJournalStore) AttachmentClaimsCurrent(_ context.Context, _ primitive.ObjectID, ids []primitive.ObjectID, token string) (bool, error) {
	return len(ids) == 0 || (s.available && !s.deleting && s.claimToken == token), nil
}

func (s *mutableJournalStore) FindJournalEntry(_ context.Context, userID primitive.ObjectID, date string) (models.JournalEntry, error) {
	if s.entry == nil || s.entry.UserID != userID || s.entry.Date != date || s.entry.MutationToken != "" {
		return models.JournalEntry{}, mongo.ErrNoDocuments
	}
	return *s.entry, nil
}

func (s *mutableJournalStore) SaveJournalMutation(_ context.Context, desired models.JournalEntry, expected int64, token string) (models.JournalEntry, error) {
	if s.entry == nil {
		if expected != 0 {
			return models.JournalEntry{}, errJournalRevisionConflict
		}
	} else if s.entry.Revision != expected || s.entry.MutationToken != "" {
		return models.JournalEntry{}, errJournalRevisionConflict
	}
	desired.Revision = expected + 1
	desired.MutationToken = token
	if s.entry != nil {
		desired.ID = s.entry.ID
		desired.CreatedAt = s.entry.CreatedAt
	}
	s.entry = &desired
	if s.onSave != nil {
		s.onSave(s)
	}
	return desired, nil
}

func (s *mutableJournalStore) FinalizeJournalMutation(_ context.Context, saved models.JournalEntry, token string) (models.JournalEntry, error) {
	if s.entry == nil || s.entry.ID != saved.ID || s.entry.Revision != saved.Revision || s.entry.MutationToken != token {
		return models.JournalEntry{}, mongo.ErrNoDocuments
	}
	s.entry.MutationToken = ""
	return *s.entry, nil
}

func (s *mutableJournalStore) RollbackJournalMutation(_ context.Context, previous *models.JournalEntry, saved models.JournalEntry, token string) error {
	s.rollbackCalls++
	if s.onCompensate != nil {
		s.onCompensate(s)
	}
	if s.entry == nil || s.entry.ID != saved.ID || s.entry.Revision != saved.Revision || s.entry.MutationToken != token {
		return nil
	}
	if previous == nil {
		s.entry = nil
	} else {
		copy := *previous
		s.entry = &copy
	}
	return nil
}

func (s *mutableJournalStore) FenceJournalAttachment(_ context.Context, userID, id primitive.ObjectID, token string, _ time.Time) (models.JournalAttachment, error) {
	if userID != s.owner || id != s.attachmentID || !s.available {
		return models.JournalAttachment{}, mongo.ErrNoDocuments
	}
	if s.deleting {
		return models.JournalAttachment{ID: id, UserID: userID, DeletionState: journalAttachmentDeleting, DeletionToken: s.deleteToken}, nil
	}
	if s.claimToken != "" {
		return models.JournalAttachment{}, errJournalAttachmentBusy
	}
	s.deleting, s.deleteToken = true, token
	return models.JournalAttachment{ID: id, UserID: userID, DeletionState: journalAttachmentDeleting, DeletionToken: token}, nil
}

func (s *mutableJournalStore) CountJournalAttachmentReferences(_ context.Context, userID, id primitive.ObjectID) (int64, error) {
	if userID != s.owner || id != s.attachmentID {
		return 0, nil
	}
	if s.entry != nil {
		for _, attachmentID := range s.entry.AttachmentIDs {
			if attachmentID == id {
				return 1, nil
			}
		}
	}
	return s.references, nil
}

func (s *mutableJournalStore) RestoreJournalAttachment(_ context.Context, userID, id primitive.ObjectID, token string) error {
	if userID != s.owner || id != s.attachmentID || token != s.deleteToken {
		return errJournalAttachmentUnavailable
	}
	s.deleting, s.deleteToken = false, ""
	return nil
}

func (s *mutableJournalStore) DeleteFencedJournalAttachment(_ context.Context, userID, id primitive.ObjectID, token string) (bool, error) {
	if userID != s.owner || id != s.attachmentID || !s.deleting || token != s.deleteToken {
		return false, nil
	}
	s.available, s.deleting = false, false
	return true, nil
}

func newMutableJournalStore() *mutableJournalStore {
	return &mutableJournalStore{owner: primitive.NewObjectID(), attachmentID: primitive.NewObjectID(), available: true}
}

func TestJournalPutBeforeTombstoneBlocksDeleteAndCommits(t *testing.T) {
	store := newMutableJournalStore()
	store.onSave = func(s *mutableJournalStore) {
		err := deleteJournalAttachmentFenced(context.Background(), s, s.owner, s.attachmentID, time.Now())
		if !errors.Is(err, errJournalAttachmentBusy) {
			t.Fatalf("delete during claimed PUT = %v, want busy", err)
		}
	}
	entry, err := putJournalEntryFenced(context.Background(), store, store.owner, "2026-08-07", "![x](/api/journal/attachments/"+store.attachmentID.Hex()+")", []primitive.ObjectID{store.attachmentID}, 0, time.Now())
	if err != nil || entry.Revision != 1 || store.entry == nil || store.entry.MutationToken != "" {
		t.Fatalf("PUT result = %#v, err=%v, stored=%#v", entry, err, store.entry)
	}
}

func TestJournalPutAfterTombstoneIsRejected(t *testing.T) {
	store := newMutableJournalStore()
	store.deleting, store.deleteToken = true, "delete"
	_, err := putJournalEntryFenced(context.Background(), store, store.owner, "2026-08-07", "x", []primitive.ObjectID{store.attachmentID}, 0, time.Now())
	if !errors.Is(err, errJournalAttachmentUnavailable) || store.entry != nil {
		t.Fatalf("PUT err=%v entry=%#v, want unavailable and no write", err, store.entry)
	}
}

func TestJournalPutPostValidationRollsBackOwnRevision(t *testing.T) {
	store := newMutableJournalStore()
	previous := models.JournalEntry{ID: primitive.NewObjectID(), UserID: store.owner, Date: "2026-08-07", Markdown: "old", Revision: 3}
	store.entry = &previous
	store.onSave = func(s *mutableJournalStore) {
		s.claimToken = ""
		s.deleting, s.deleteToken = true, "delete"
	}
	_, err := putJournalEntryFenced(context.Background(), store, store.owner, previous.Date, "new", []primitive.ObjectID{store.attachmentID}, 3, time.Now())
	if !errors.Is(err, errJournalAttachmentUnavailable) || store.rollbackCalls != 1 || store.entry == nil || store.entry.Revision != 3 || store.entry.Markdown != "old" {
		t.Fatalf("err=%v rollbacks=%d entry=%#v", err, store.rollbackCalls, store.entry)
	}
}

func TestJournalStaleRevisionDoesNotMutateAndReleasesClaim(t *testing.T) {
	store := newMutableJournalStore()
	store.entry = &models.JournalEntry{ID: primitive.NewObjectID(), UserID: store.owner, Date: "2026-08-07", Revision: 4, Markdown: "authoritative"}
	_, err := putJournalEntryFenced(context.Background(), store, store.owner, "2026-08-07", "stale", []primitive.ObjectID{store.attachmentID}, 3, time.Now())
	if !errors.Is(err, errJournalRevisionConflict) || store.entry.Markdown != "authoritative" || store.claimToken != "" {
		t.Fatalf("err=%v entry=%#v claim=%q", err, store.entry, store.claimToken)
	}
}

func TestJournalRollbackNeverRemovesNewerRevision(t *testing.T) {
	store := newMutableJournalStore()
	store.onSave = func(s *mutableJournalStore) { s.deleting = true }
	store.onCompensate = func(s *mutableJournalStore) {
		newer := *s.entry
		newer.Revision++
		newer.Markdown = "newer"
		newer.MutationToken = "newer-token"
		s.entry = &newer
	}
	_, err := putJournalEntryFenced(context.Background(), store, store.owner, "2026-08-07", "loser", []primitive.ObjectID{store.attachmentID}, 0, time.Now())
	if !errors.Is(err, errJournalAttachmentUnavailable) || store.entry == nil || store.entry.Markdown != "newer" {
		t.Fatalf("err=%v entry=%#v", err, store.entry)
	}
}

func TestJournalDeleteRestoresTombstoneWhenReferencedAndIsOwnerScoped(t *testing.T) {
	store := newMutableJournalStore()
	store.references = 1
	err := deleteJournalAttachmentFenced(context.Background(), store, store.owner, store.attachmentID, time.Now())
	if !errors.Is(err, errJournalAttachmentReferenced) || store.deleting || !store.available {
		t.Fatalf("referenced delete err=%v deleting=%v available=%v", err, store.deleting, store.available)
	}
	otherOwner := primitive.NewObjectID()
	if err := deleteJournalAttachmentFenced(context.Background(), store, otherOwner, store.attachmentID, time.Now()); err != nil || !store.available {
		t.Fatalf("wrong-owner delete changed state: err=%v available=%v", err, store.available)
	}
	store.references = 0
	if err := deleteJournalAttachmentFenced(context.Background(), store, store.owner, store.attachmentID, time.Now()); err != nil || store.available {
		t.Fatalf("owner delete err=%v available=%v", err, store.available)
	}
	if err := deleteJournalAttachmentFenced(context.Background(), store, store.owner, store.attachmentID, time.Now()); err != nil {
		t.Fatalf("idempotent retry err=%v", err)
	}
}
