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

type manualShowUpStore interface {
	GoalActivityCurrent(context.Context, models.Goal) (bool, error)
	MutateManualShowUp(context.Context, models.ShowUp, string) (*models.ShowUp, models.ShowUp, error)
	FinalizeManualShowUp(context.Context, models.ShowUp, string) (models.ShowUp, error)
	CompensateManualShowUp(context.Context, *models.ShowUp, models.ShowUp, string) error
}

type mongoManualShowUpStore struct{}

func currentManualShowUpStore() manualShowUpStore { return mongoManualShowUpStore{} }

func (mongoManualShowUpStore) GoalActivityCurrent(ctx context.Context, goal models.Goal) (bool, error) {
	return mongoGoalStore{}.GoalDefinitionCurrent(ctx, goal, nil)
}

func showUpMutationIdentity(entry models.ShowUp) bson.M {
	return bson.M{"userId": entry.UserID, "goalId": entry.GoalID, "date": entry.Date}
}

func availableManualShowUpToken() bson.A {
	return bson.A{
		bson.M{"mutationToken": bson.M{"$exists": false}},
		bson.M{"mutationToken": ""},
	}
}

func (mongoManualShowUpStore) MutateManualShowUp(ctx context.Context, desired models.ShowUp, token string) (*models.ShowUp, models.ShowUp, error) {
	collection := config.DB.Collection(showUpsCollection)
	desired.MutationToken = token

	// Acquire an existing committed row and capture its rollback image in the
	// same atomic operation. A separate read followed by a CAS can retain an
	// older rollback image if another writer commits an ABA-compatible value.
	filter := showUpMutationIdentity(desired)
	filter["$or"] = availableManualShowUpToken()
	var previous models.ShowUp
	err := collection.FindOneAndUpdate(ctx, filter, bson.M{
		"$set": bson.M{
			"status": desired.Status, "source": models.GoalSourceManual, "note": desired.Note,
			"updatedAt": desired.UpdatedAt, "mutationToken": token,
		},
		"$unset": bson.M{"definitionVersion": ""},
	}, options.FindOneAndUpdate().SetReturnDocument(options.Before)).Decode(&previous)
	if err == nil {
		desired.ID = previous.ID
		desired.CreatedAt = previous.CreatedAt
		return &previous, desired, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, models.ShowUp{}, err
	}

	// No available row matched. Insert only if the identity is truly absent;
	// a duplicate means either an existing owner or a concurrent acquisition.
	if _, insertErr := collection.InsertOne(ctx, desired); insertErr != nil {
		if mongo.IsDuplicateKeyError(insertErr) {
			return nil, models.ShowUp{}, errGoalConflict
		}
		return nil, models.ShowUp{}, insertErr
	}
	return nil, desired, nil
}

func (mongoManualShowUpStore) FinalizeManualShowUp(ctx context.Context, saved models.ShowUp, token string) (models.ShowUp, error) {
	filter := showUpMutationIdentity(saved)
	filter["_id"] = saved.ID
	filter["mutationToken"] = token
	var finalized models.ShowUp
	err := config.DB.Collection(showUpsCollection).FindOneAndUpdate(ctx, filter,
		bson.M{"$unset": bson.M{"mutationToken": ""}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&finalized)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.ShowUp{}, errGoalConflict
	}
	return finalized, err
}

func (mongoManualShowUpStore) CompensateManualShowUp(ctx context.Context, previous *models.ShowUp, saved models.ShowUp, token string) error {
	filter := showUpMutationIdentity(saved)
	filter["_id"] = saved.ID
	filter["mutationToken"] = token
	if previous == nil {
		_, err := config.DB.Collection(showUpsCollection).DeleteOne(ctx, filter)
		return err
	}
	restored := *previous
	// Mutate only accepts a committed row, so a rollback must never revive an
	// in-flight token even if a non-production store supplies a malformed prior.
	restored.MutationToken = ""
	_, err := config.DB.Collection(showUpsCollection).ReplaceOne(ctx, filter, restored)
	return err
}

func putManualShowUpFenced(ctx context.Context, store manualShowUpStore, goal models.Goal, date, status, note string, now time.Time) (models.ShowUp, error) {
	current, err := store.GoalActivityCurrent(ctx, goal)
	if err != nil {
		return models.ShowUp{}, err
	}
	if !current {
		return models.ShowUp{}, errGoalDefinitionStale
	}
	token := primitive.NewObjectID().Hex()
	desired := models.ShowUp{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID, Date: date,
		Status: status, Source: models.GoalSourceManual, Note: note,
		CreatedAt: now, UpdatedAt: now,
	}
	previous, saved, err := store.MutateManualShowUp(ctx, desired, token)
	if err != nil {
		return models.ShowUp{}, err
	}
	current, checkErr := store.GoalActivityCurrent(ctx, goal)
	if checkErr != nil || !current {
		cleanupErr := store.CompensateManualShowUp(ctx, previous, saved, token)
		if checkErr != nil {
			return models.ShowUp{}, errors.Join(checkErr, cleanupErr)
		}
		return models.ShowUp{}, errors.Join(errGoalDefinitionStale, cleanupErr)
	}
	finalized, finalizeErr := store.FinalizeManualShowUp(ctx, saved, token)
	if finalizeErr != nil {
		cleanupErr := store.CompensateManualShowUp(ctx, previous, saved, token)
		return models.ShowUp{}, errors.Join(finalizeErr, cleanupErr)
	}
	return finalized, nil
}
