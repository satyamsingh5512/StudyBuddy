package handlers

import (
	"context"
	"errors"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	journalAttachmentDeleting = "deleting"
	journalClaimLifetime      = 30 * time.Second
)

var (
	errJournalAttachmentUnavailable = errors.New("journal attachment unavailable")
	errJournalAttachmentBusy        = errors.New("journal attachment write in progress")
	errJournalAttachmentReferenced  = errors.New("journal attachment is referenced")
	errJournalRevisionConflict      = errors.New("journal revision conflict")
)

type journalMutationStore interface {
	AcquireAttachmentClaims(context.Context, primitive.ObjectID, []primitive.ObjectID, string, time.Time) error
	ReleaseAttachmentClaims(context.Context, primitive.ObjectID, []primitive.ObjectID, string) error
	AttachmentClaimsCurrent(context.Context, primitive.ObjectID, []primitive.ObjectID, string) (bool, error)
	FindJournalEntry(context.Context, primitive.ObjectID, string) (models.JournalEntry, error)
	SaveJournalMutation(context.Context, models.JournalEntry, int64, string) (models.JournalEntry, error)
	FinalizeJournalMutation(context.Context, models.JournalEntry, string) (models.JournalEntry, error)
	RollbackJournalMutation(context.Context, *models.JournalEntry, models.JournalEntry, string) error
	FenceJournalAttachment(context.Context, primitive.ObjectID, primitive.ObjectID, string, time.Time) (models.JournalAttachment, error)
	CountJournalAttachmentReferences(context.Context, primitive.ObjectID, primitive.ObjectID) (int64, error)
	RestoreJournalAttachment(context.Context, primitive.ObjectID, primitive.ObjectID, string) error
	DeleteFencedJournalAttachment(context.Context, primitive.ObjectID, primitive.ObjectID, string) (bool, error)
}

type mongoJournalStore struct{}

var journalMutationStoreFactory = func() journalMutationStore { return mongoJournalStore{} }

func currentJournalMutationStore() journalMutationStore { return journalMutationStoreFactory() }

func (mongoJournalStore) AcquireAttachmentClaims(ctx context.Context, userID primitive.ObjectID, ids []primitive.ObjectID, token string, expiresAt time.Time) error {
	acquired := make([]primitive.ObjectID, 0, len(ids))
	for _, id := range ids {
		result, err := config.DB.Collection(journalAttachmentsCollection).UpdateOne(ctx, bson.M{
			"_id": id, "userId": userID, "deletionState": bson.M{"$exists": false},
		}, bson.M{"$push": bson.M{"referenceClaims": models.JournalAttachmentClaim{Token: token, ExpiresAt: expiresAt}}})
		if err == nil && result.MatchedCount == 1 {
			acquired = append(acquired, id)
			continue
		}
		_ = mongoJournalStore{}.ReleaseAttachmentClaims(ctx, userID, acquired, token)
		if err != nil {
			return err
		}
		return errJournalAttachmentUnavailable
	}
	return nil
}

func (mongoJournalStore) ReleaseAttachmentClaims(ctx context.Context, userID primitive.ObjectID, ids []primitive.ObjectID, token string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := config.DB.Collection(journalAttachmentsCollection).UpdateMany(ctx, bson.M{
		"userId": userID, "_id": bson.M{"$in": ids},
	}, bson.M{"$pull": bson.M{"referenceClaims": bson.M{"token": token}}})
	return err
}

func (mongoJournalStore) AttachmentClaimsCurrent(ctx context.Context, userID primitive.ObjectID, ids []primitive.ObjectID, token string) (bool, error) {
	if len(ids) == 0 {
		return true, nil
	}
	count, err := config.DB.Collection(journalAttachmentsCollection).CountDocuments(ctx, bson.M{
		"userId": userID, "_id": bson.M{"$in": ids}, "deletionState": bson.M{"$exists": false},
		"referenceClaims": bson.M{"$elemMatch": bson.M{"token": token}},
	})
	return count == int64(len(ids)), err
}

func (mongoJournalStore) FindJournalEntry(ctx context.Context, userID primitive.ObjectID, date string) (models.JournalEntry, error) {
	var entry models.JournalEntry
	err := config.DB.Collection(journalEntriesCollection).FindOne(ctx, bson.M{
		"userId": userID, "date": date, "mutationToken": bson.M{"$exists": false},
	}).Decode(&entry)
	return entry, err
}

func (mongoJournalStore) SaveJournalMutation(ctx context.Context, desired models.JournalEntry, expectedRevision int64, token string) (models.JournalEntry, error) {
	filter := journalRevisionFilter(desired.UserID, desired.Date, expectedRevision)
	filter["mutationToken"] = bson.M{"$exists": false}
	update := bson.M{
		"$set": bson.M{
			"markdown": desired.Markdown, "attachmentIds": desired.AttachmentIDs,
			"updatedAt": desired.UpdatedAt, "mutationToken": token,
		},
		"$inc": bson.M{"revision": int64(1)},
	}
	if expectedRevision == 0 {
		update["$setOnInsert"] = bson.M{
			"_id": desired.ID, "userId": desired.UserID, "date": desired.Date, "createdAt": desired.CreatedAt,
		}
	}
	var saved models.JournalEntry
	err := config.DB.Collection(journalEntriesCollection).FindOneAndUpdate(ctx, filter, update,
		options.FindOneAndUpdate().SetUpsert(expectedRevision == 0).SetReturnDocument(options.After)).Decode(&saved)
	if errors.Is(err, mongo.ErrNoDocuments) || mongo.IsDuplicateKeyError(err) {
		return models.JournalEntry{}, errJournalRevisionConflict
	}
	return saved, err
}

func (mongoJournalStore) FinalizeJournalMutation(ctx context.Context, saved models.JournalEntry, token string) (models.JournalEntry, error) {
	filter := bson.M{
		"_id": saved.ID, "userId": saved.UserID, "date": saved.Date,
		"revision": saved.Revision, "mutationToken": token,
	}
	var finalized models.JournalEntry
	err := config.DB.Collection(journalEntriesCollection).FindOneAndUpdate(ctx, filter,
		bson.M{"$unset": bson.M{"mutationToken": ""}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&finalized)
	return finalized, err
}

func (mongoJournalStore) RollbackJournalMutation(ctx context.Context, previous *models.JournalEntry, saved models.JournalEntry, token string) error {
	filter := bson.M{
		"_id": saved.ID, "userId": saved.UserID, "date": saved.Date,
		"revision": saved.Revision, "mutationToken": token,
	}
	if previous == nil {
		_, err := config.DB.Collection(journalEntriesCollection).DeleteOne(ctx, filter)
		return err
	}
	previous.MutationToken = ""
	_, err := config.DB.Collection(journalEntriesCollection).ReplaceOne(ctx, filter, *previous)
	return err
}

func (mongoJournalStore) FenceJournalAttachment(ctx context.Context, userID, id primitive.ObjectID, token string, now time.Time) (models.JournalAttachment, error) {
	filter := bson.M{
		"_id": id, "userId": userID, "deletionState": bson.M{"$exists": false},
		"referenceClaims": bson.M{"$not": bson.M{"$elemMatch": bson.M{"expiresAt": bson.M{"$gt": now}}}},
	}
	var attachment models.JournalAttachment
	err := config.DB.Collection(journalAttachmentsCollection).FindOneAndUpdate(ctx, filter,
		bson.M{"$set": bson.M{"deletionState": journalAttachmentDeleting, "deletionToken": token}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&attachment)
	if err == nil {
		return attachment, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return models.JournalAttachment{}, err
	}
	// Continue a prior interrupted owner-scoped deletion with its durable token.
	err = config.DB.Collection(journalAttachmentsCollection).FindOne(ctx, bson.M{
		"_id": id, "userId": userID,
	}).Decode(&attachment)
	if err != nil {
		return models.JournalAttachment{}, err
	}
	if attachment.DeletionState == journalAttachmentDeleting && attachment.DeletionToken != "" {
		return attachment, nil
	}
	return models.JournalAttachment{}, errJournalAttachmentBusy
}

func (mongoJournalStore) CountJournalAttachmentReferences(ctx context.Context, userID, id primitive.ObjectID) (int64, error) {
	return config.DB.Collection(journalEntriesCollection).CountDocuments(ctx, bson.M{
		"userId": userID, "attachmentIds": id,
	}, options.Count().SetLimit(1))
}

func (mongoJournalStore) RestoreJournalAttachment(ctx context.Context, userID, id primitive.ObjectID, token string) error {
	result, err := config.DB.Collection(journalAttachmentsCollection).UpdateOne(ctx, bson.M{
		"_id": id, "userId": userID, "deletionState": journalAttachmentDeleting, "deletionToken": token,
	}, bson.M{"$unset": bson.M{"deletionState": "", "deletionToken": ""}})
	if err == nil && result.MatchedCount == 0 {
		return errJournalAttachmentUnavailable
	}
	return err
}

func (mongoJournalStore) DeleteFencedJournalAttachment(ctx context.Context, userID, id primitive.ObjectID, token string) (bool, error) {
	result, err := config.DB.Collection(journalAttachmentsCollection).DeleteOne(ctx, bson.M{
		"_id": id, "userId": userID, "deletionState": journalAttachmentDeleting, "deletionToken": token,
	})
	return result != nil && result.DeletedCount == 1, err
}

func putJournalEntryFenced(ctx context.Context, store journalMutationStore, userID primitive.ObjectID, date, markdown string, attachmentIDs []primitive.ObjectID, expectedRevision int64, now time.Time) (models.JournalEntry, error) {
	token := primitive.NewObjectID().Hex()
	if err := store.AcquireAttachmentClaims(ctx, userID, attachmentIDs, token, now.Add(journalClaimLifetime)); err != nil {
		return models.JournalEntry{}, err
	}
	defer func() { _ = store.ReleaseAttachmentClaims(ctx, userID, attachmentIDs, token) }()

	var previous *models.JournalEntry
	if expectedRevision > 0 {
		entry, err := store.FindJournalEntry(ctx, userID, date)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return models.JournalEntry{}, errJournalRevisionConflict
			}
			return models.JournalEntry{}, err
		}
		if entry.Revision != expectedRevision {
			return models.JournalEntry{}, errJournalRevisionConflict
		}
		previous = &entry
	}

	desired := models.JournalEntry{
		ID: primitive.NewObjectID(), UserID: userID, Date: date, Markdown: markdown,
		AttachmentIDs: attachmentIDs, CreatedAt: now, UpdatedAt: now,
	}
	saved, err := store.SaveJournalMutation(ctx, desired, expectedRevision, token)
	if err != nil {
		return models.JournalEntry{}, err
	}
	current, checkErr := store.AttachmentClaimsCurrent(ctx, userID, attachmentIDs, token)
	if checkErr != nil || !current {
		rollbackErr := store.RollbackJournalMutation(ctx, previous, saved, token)
		if checkErr != nil {
			return models.JournalEntry{}, errors.Join(checkErr, rollbackErr)
		}
		return models.JournalEntry{}, errors.Join(errJournalAttachmentUnavailable, rollbackErr)
	}
	finalized, err := store.FinalizeJournalMutation(ctx, saved, token)
	if err != nil {
		return models.JournalEntry{}, errors.Join(err, store.RollbackJournalMutation(ctx, previous, saved, token))
	}
	return finalized, nil
}

func deleteJournalAttachmentFenced(ctx context.Context, store journalMutationStore, userID, id primitive.ObjectID, now time.Time) error {
	token := primitive.NewObjectID().Hex()
	attachment, err := store.FenceJournalAttachment(ctx, userID, id, token, now)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil
	}
	if err != nil {
		return err
	}
	token = attachment.DeletionToken
	if token == "" {
		return errJournalAttachmentUnavailable
	}
	references, err := store.CountJournalAttachmentReferences(ctx, userID, id)
	if err != nil {
		return err
	}
	if references > 0 {
		return errors.Join(errJournalAttachmentReferenced, store.RestoreJournalAttachment(ctx, userID, id, token))
	}
	deleted, err := store.DeleteFencedJournalAttachment(ctx, userID, id, token)
	if err != nil {
		return err
	}
	if !deleted {
		// Another retry may have completed the same durable tombstone after we
		// loaded it. The owner-scoped object is already in the requested state.
		return nil
	}
	return nil
}
