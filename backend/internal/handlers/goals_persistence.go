package handlers

import (
	"context"
	"errors"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var errTransactionsUnavailable = errors.New("mongo transactions are unavailable")

type goalMutationStore interface {
	RunTransaction(context.Context, func(context.Context) error) error
	SaveGoalDefinition(context.Context, time.Time, int64, *models.Goal) error
	CleanupStaleGoalActivity(context.Context, models.Goal) error
	RecomputeAutomaticShowUp(context.Context, models.Goal, string) error
	FindAndDeleteShowUp(context.Context, primitive.ObjectID, primitive.ObjectID, string) (models.ShowUp, error)
	RestoreShowUp(context.Context, models.ShowUp) error
}

type goalActivityMutationStore interface {
	RunTransaction(context.Context, func(context.Context) error) error
	GoalDefinitionCurrent(context.Context, models.Goal, *primitive.ObjectID) (bool, error)
	UpsertGoalCompletion(context.Context, models.GoalCompletion) (models.GoalCompletion, error)
	DeleteGoalCompletion(context.Context, models.GoalCompletion) (bool, error)
	FindShowUp(context.Context, models.Goal, string) (models.ShowUp, error)
	FindCurrentGoalCompletions(context.Context, models.Goal, string) ([]models.GoalCompletion, error)
	UpsertAutomaticShowUp(context.Context, models.Goal, string, string) error
	DeleteAutomaticShowUp(context.Context, models.Goal, string) error
}

type goalDeletionStore interface {
	RunTransaction(context.Context, func(context.Context) error) error
	FenceGoalDeletion(context.Context, primitive.ObjectID, primitive.ObjectID, string, time.Time) (models.Goal, error)
	DeleteGoalCompletions(context.Context, primitive.ObjectID, primitive.ObjectID) error
	DeleteGoalShowUps(context.Context, primitive.ObjectID, primitive.ObjectID) error
	DeleteGoalCheckIns(context.Context, primitive.ObjectID, primitive.ObjectID) error
	FinishGoalDeletion(context.Context, primitive.ObjectID, primitive.ObjectID, string) (bool, error)
}

type mongoGoalStore struct{}

func currentGoalMutationStore() goalMutationStore         { return mongoGoalStore{} }
func currentGoalActivityStore() goalActivityMutationStore { return mongoGoalStore{} }
func currentGoalDeletionStore() goalDeletionStore         { return mongoGoalStore{} }

func (mongoGoalStore) RunTransaction(ctx context.Context, fn func(context.Context) error) error {
	session, err := config.DB.Client().StartSession()
	if err != nil {
		if transactionUnavailable(err) {
			return errTransactionsUnavailable
		}
		return err
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(tx mongo.SessionContext) (interface{}, error) {
		if err := fn(tx); err != nil {
			return nil, err
		}
		return nil, nil
	})
	if transactionUnavailable(err) {
		return errTransactionsUnavailable
	}
	return err
}

func transactionUnavailable(err error) bool {
	if err == nil {
		return false
	}
	var commandErr mongo.CommandError
	if errors.As(err, &commandErr) && (commandErr.Code == 20 || commandErr.Code == 303) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "transaction numbers are only allowed") ||
		strings.Contains(message, "transactions are not supported") ||
		strings.Contains(message, "sessions are not supported") ||
		strings.Contains(message, "does not support sessions")
}

const goalDeleteStateDeleting = "deleting"

func (mongoGoalStore) FenceGoalDeletion(ctx context.Context, userID, goalID primitive.ObjectID, token string, now time.Time) (models.Goal, error) {
	filter := goalOwnedFilter(goalID, userID)
	filter["deleteState"] = bson.M{"$exists": false}
	update := bson.M{
		"$set": bson.M{
			"deleteState": goalDeleteStateDeleting,
			"deleteToken": token,
			"deletingAt":  now,
			"updatedAt":   now,
		},
		"$inc": bson.M{"definitionVersion": int64(1)},
	}
	var goal models.Goal
	err := config.DB.Collection(goalsCollection).FindOneAndUpdate(
		ctx,
		filter,
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&goal)
	if err == nil {
		return goal, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return models.Goal{}, err
	}

	// A prior standalone attempt may have fenced the goal before a child
	// collection failed. Reuse its token so DELETE is safely retryable.
	retryFilter := goalOwnedFilter(goalID, userID)
	retryFilter["deleteState"] = goalDeleteStateDeleting
	err = config.DB.Collection(goalsCollection).FindOne(ctx, retryFilter).Decode(&goal)
	return goal, err
}

func deleteOwnedGoalActivity(ctx context.Context, collection string, userID, goalID primitive.ObjectID) error {
	_, err := config.DB.Collection(collection).DeleteMany(ctx, bson.M{"userId": userID, "goalId": goalID})
	return err
}

func (mongoGoalStore) DeleteGoalCompletions(ctx context.Context, userID, goalID primitive.ObjectID) error {
	return deleteOwnedGoalActivity(ctx, goalCompletionsCollection, userID, goalID)
}

func (mongoGoalStore) DeleteGoalShowUps(ctx context.Context, userID, goalID primitive.ObjectID) error {
	return deleteOwnedGoalActivity(ctx, showUpsCollection, userID, goalID)
}

func (mongoGoalStore) DeleteGoalCheckIns(ctx context.Context, userID, goalID primitive.ObjectID) error {
	return deleteOwnedGoalActivity(ctx, goalCheckInsCollection, userID, goalID)
}

func (mongoGoalStore) FinishGoalDeletion(ctx context.Context, userID, goalID primitive.ObjectID, token string) (bool, error) {
	filter := goalOwnedFilter(goalID, userID)
	filter["deleteState"] = goalDeleteStateDeleting
	filter["deleteToken"] = token
	result, err := config.DB.Collection(goalsCollection).DeleteOne(ctx, filter)
	return result != nil && result.DeletedCount == 1, err
}

type goalDeletionResult struct {
	CleanupPending bool
	CleanupError   error
}

func sweepGoalActivity(ctx context.Context, store goalDeletionStore, userID, goalID primitive.ObjectID) error {
	// Do not stop after one collection fails: every retry is an opportunity to
	// remove as much owner-scoped activity as possible.
	return errors.Join(
		store.DeleteGoalCompletions(ctx, userID, goalID),
		store.DeleteGoalShowUps(ctx, userID, goalID),
		store.DeleteGoalCheckIns(ctx, userID, goalID),
	)
}

func deleteGoalWithStore(ctx context.Context, store goalDeletionStore, userID, goalID primitive.ObjectID) (goalDeletionResult, error) {
	token := primitive.NewObjectID().Hex()
	transactionalDelete := func(opCtx context.Context) error {
		goal, err := store.FenceGoalDeletion(opCtx, userID, goalID, token, goalNow().UTC())
		if err != nil {
			return err
		}
		// A retry of a partially completed standalone delete must retain the
		// persisted token rather than replacing the tombstone.
		token = goal.DeleteToken
		if token == "" {
			return errGoalConflict
		}
		if err := sweepGoalActivity(opCtx, store, userID, goalID); err != nil {
			return err
		}
		deleted, err := store.FinishGoalDeletion(opCtx, userID, goalID, token)
		if err != nil {
			return err
		}
		if !deleted {
			return errGoalConflict
		}
		return nil
	}

	err := store.RunTransaction(ctx, transactionalDelete)
	if err == nil {
		return goalDeletionResult{}, nil
	}
	if !errors.Is(err, errTransactionsUnavailable) {
		return goalDeletionResult{}, err
	}

	// Standalone MongoDB cannot prove that a writer which loaded the old
	// definition before the fence has quiesced. Persist the tombstone/version
	// fence, hide the goal immediately, and never claim permanent completion or
	// remove that durable recovery state. Repeated sweeps narrow the orphan
	// window; DELETE retries repeat them and a future transaction-capable retry
	// can atomically sweep and finalize.
	goal, fenceErr := store.FenceGoalDeletion(ctx, userID, goalID, token, goalNow().UTC())
	if fenceErr != nil {
		return goalDeletionResult{}, fenceErr
	}
	if goal.DeleteToken == "" {
		return goalDeletionResult{}, errGoalConflict
	}
	firstSweepErr := sweepGoalActivity(ctx, store, userID, goalID)
	secondSweepErr := sweepGoalActivity(ctx, store, userID, goalID)
	return goalDeletionResult{
		CleanupPending: true,
		CleanupError:   errors.Join(firstSweepErr, secondSweepErr),
	}, nil
}
func (mongoGoalStore) SaveGoalDefinition(ctx context.Context, originalUpdatedAt time.Time, originalDefinitionVersion int64, goal *models.Goal) error {
	return saveGoalDefinition(ctx, originalUpdatedAt, originalDefinitionVersion, goal)
}

func staleCompletionFilter(goal models.Goal) bson.M {
	return bson.M{
		"userId": goal.UserID,
		"goalId": goal.ID,
		"$or": bson.A{
			bson.M{"definitionVersion": bson.M{"$ne": goal.DefinitionVersion}},
			bson.M{"subGoalId": bson.M{"$nin": validSubGoalIDs(goal)}},
		},
	}
}

func staleAutomaticShowUpFilter(goal models.Goal) bson.M {
	return bson.M{
		"userId":            goal.UserID,
		"goalId":            goal.ID,
		"source":            models.GoalSourceAutomatic,
		"definitionVersion": bson.M{"$ne": goal.DefinitionVersion},
	}
}

func (mongoGoalStore) CleanupStaleGoalActivity(ctx context.Context, goal models.Goal) error {
	_, completionErr := config.DB.Collection(goalCompletionsCollection).DeleteMany(ctx, staleCompletionFilter(goal))
	_, showUpErr := config.DB.Collection(showUpsCollection).DeleteMany(ctx, staleAutomaticShowUpFilter(goal))
	return errors.Join(completionErr, showUpErr)
}

func saveSubGoalDefinition(ctx context.Context, store goalMutationStore, originalUpdatedAt time.Time, originalDefinitionVersion int64, goal *models.Goal) error {
	operation := func(opCtx context.Context) error {
		if err := store.SaveGoalDefinition(opCtx, originalUpdatedAt, originalDefinitionVersion, goal); err != nil {
			return err
		}
		return store.CleanupStaleGoalActivity(opCtx, *goal)
	}
	if err := store.RunTransaction(ctx, operation); !errors.Is(err, errTransactionsUnavailable) {
		return err
	}

	// A standalone MongoDB cannot atomically save the new generation and clean
	// child collections. Save the fenced definition first so every read stops
	// observing the old generation, then make cleanup best effort. A stale row
	// inserted after cleanup remains physically historical but cannot affect a
	// current read, statistic, or automatic derivation.
	if err := store.SaveGoalDefinition(ctx, originalUpdatedAt, originalDefinitionVersion, goal); err != nil {
		return err
	}
	_ = store.CleanupStaleGoalActivity(ctx, *goal)
	return nil
}

func goalDefinitionCurrentFilter(goal models.Goal, subGoalID *primitive.ObjectID) bson.M {
	filter := activeGoalOwnedFilter(goal.ID, goal.UserID)
	filter["status"] = models.GoalStatusActive
	filter["updatedAt"] = goal.UpdatedAt
	for key, value := range definitionVersionFilter(goal.DefinitionVersion) {
		filter[key] = value
	}
	if subGoalID != nil {
		filter["subGoals._id"] = *subGoalID
	}
	return filter
}

func (mongoGoalStore) GoalDefinitionCurrent(ctx context.Context, goal models.Goal, subGoalID *primitive.ObjectID) (bool, error) {
	count, err := config.DB.Collection(goalsCollection).CountDocuments(ctx, goalDefinitionCurrentFilter(goal, subGoalID), options.Count().SetLimit(1))
	return count == 1, err
}

func completionIdentity(entry models.GoalCompletion) bson.M {
	return bson.M{
		"userId": entry.UserID, "goalId": entry.GoalID,
		"subGoalId": entry.SubGoalID, "date": entry.Date,
	}
}

func completionUpsertFilter(entry models.GoalCompletion) bson.M {
	filter := completionIdentity(entry)
	filter["$or"] = bson.A{
		bson.M{"definitionVersion": bson.M{"$lte": entry.DefinitionVersion}},
		bson.M{"definitionVersion": bson.M{"$exists": false}},
	}
	return filter
}

func (mongoGoalStore) UpsertGoalCompletion(ctx context.Context, entry models.GoalCompletion) (models.GoalCompletion, error) {
	update := bson.M{
		"$set": bson.M{
			"status": entry.Status, "source": entry.Source, "note": entry.Note,
			"definitionVersion": entry.DefinitionVersion, "updatedAt": entry.UpdatedAt,
		},
		"$setOnInsert": bson.M{
			"_id": entry.ID, "userId": entry.UserID, "goalId": entry.GoalID,
			"subGoalId": entry.SubGoalID, "date": entry.Date, "createdAt": entry.CreatedAt,
		},
	}
	var saved models.GoalCompletion
	err := config.DB.Collection(goalCompletionsCollection).FindOneAndUpdate(
		ctx, completionUpsertFilter(entry), update,
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
	).Decode(&saved)
	if mongo.IsDuplicateKeyError(err) {
		return models.GoalCompletion{}, errGoalDefinitionStale
	}
	return saved, err
}

func (mongoGoalStore) DeleteGoalCompletion(ctx context.Context, entry models.GoalCompletion) (bool, error) {
	filter := completionIdentity(entry)
	filter["definitionVersion"] = entry.DefinitionVersion
	result, err := config.DB.Collection(goalCompletionsCollection).DeleteOne(ctx, filter)
	return result != nil && result.DeletedCount == 1, err
}

func (mongoGoalStore) FindShowUp(ctx context.Context, goal models.Goal, date string) (models.ShowUp, error) {
	var entry models.ShowUp
	err := config.DB.Collection(showUpsCollection).
		FindOne(ctx, goalActivityFilter(goal.UserID, goal.ID, "date", date)).Decode(&entry)
	return entry, err
}

func (mongoGoalStore) FindCurrentGoalCompletions(ctx context.Context, goal models.Goal, date string) ([]models.GoalCompletion, error) {
	filter := currentCompletionFilter(goal)
	filter["date"] = date
	cursor, err := config.DB.Collection(goalCompletionsCollection).Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var entries []models.GoalCompletion
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func (mongoGoalStore) UpsertAutomaticShowUp(ctx context.Context, goal models.Goal, date, status string) error {
	now := goalNow().UTC()
	update := bson.M{
		"$set": bson.M{
			"status": status, "source": models.GoalSourceAutomatic,
			"definitionVersion": goal.DefinitionVersion, "updatedAt": now,
		},
		"$unset": bson.M{"note": ""},
		"$setOnInsert": bson.M{
			"_id": primitive.NewObjectID(), "userId": goal.UserID,
			"goalId": goal.ID, "date": date, "createdAt": now,
		},
	}
	_, err := config.DB.Collection(showUpsCollection).UpdateOne(
		ctx, automaticShowUpFilter(goal, date), update, options.Update().SetUpsert(true),
	)
	if mongo.IsDuplicateKeyError(err) {
		// The unique date row may have become manual after our read. Manual rows
		// always win and are intentionally generation-independent.
		return nil
	}
	return err
}

func (mongoGoalStore) DeleteAutomaticShowUp(ctx context.Context, goal models.Goal, date string) error {
	_, err := config.DB.Collection(showUpsCollection).DeleteOne(ctx, bson.M{
		"userId": goal.UserID, "goalId": goal.ID, "date": date,
		"source": models.GoalSourceAutomatic, "definitionVersion": goal.DefinitionVersion,
	})
	return err
}

func recomputeAutomaticShowUpWithStore(ctx context.Context, store goalActivityMutationStore, goal models.Goal, date string) error {
	current, err := store.GoalDefinitionCurrent(ctx, goal, nil)
	if err != nil {
		return err
	}
	if !current {
		_ = store.DeleteAutomaticShowUp(ctx, goal, date)
		return errGoalDefinitionStale
	}

	existing, err := store.FindShowUp(ctx, goal, date)
	var existingEntry *models.ShowUp
	if err == nil {
		existingEntry = &existing
		if _, _, preserve := automaticShowUpState(goal, existingEntry, nil); preserve {
			return nil
		}
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}

	entries, err := store.FindCurrentGoalCompletions(ctx, goal, date)
	if err != nil {
		return err
	}
	current, err = store.GoalDefinitionCurrent(ctx, goal, nil)
	if err != nil {
		return err
	}
	if !current {
		_ = store.DeleteAutomaticShowUp(ctx, goal, date)
		return errGoalDefinitionStale
	}

	status, write, _ := automaticShowUpState(goal, existingEntry, entries)
	if !write {
		err = store.DeleteAutomaticShowUp(ctx, goal, date)
	} else {
		err = store.UpsertAutomaticShowUp(ctx, goal, date, status)
	}
	if err != nil {
		return err
	}

	current, err = store.GoalDefinitionCurrent(ctx, goal, nil)
	if err != nil {
		return err
	}
	if current {
		return nil
	}
	cleanupErr := store.DeleteAutomaticShowUp(ctx, goal, date)
	return errors.Join(errGoalDefinitionStale, cleanupErr)
}

func (mongoGoalStore) RecomputeAutomaticShowUp(ctx context.Context, goal models.Goal, date string) error {
	return recomputeAutomaticShowUpWithStore(ctx, mongoGoalStore{}, goal, date)
}

func cleanupStaleCompletion(ctx context.Context, store goalActivityMutationStore, goal models.Goal, entry models.GoalCompletion) error {
	_, completionErr := store.DeleteGoalCompletion(ctx, entry)
	showUpErr := store.DeleteAutomaticShowUp(ctx, goal, entry.Date)
	return errors.Join(completionErr, showUpErr)
}

func putGoalCompletionFenced(ctx context.Context, store goalActivityMutationStore, goal models.Goal, entry models.GoalCompletion) (models.GoalCompletion, error) {
	var saved models.GoalCompletion
	operation := func(opCtx context.Context) error {
		current, err := store.GoalDefinitionCurrent(opCtx, goal, &entry.SubGoalID)
		if err != nil {
			return err
		}
		if !current {
			return errGoalDefinitionStale
		}
		saved, err = store.UpsertGoalCompletion(opCtx, entry)
		if err != nil {
			return err
		}
		current, err = store.GoalDefinitionCurrent(opCtx, goal, &entry.SubGoalID)
		if err != nil {
			return err
		}
		if !current {
			return errors.Join(errGoalDefinitionStale, cleanupStaleCompletion(opCtx, store, goal, entry))
		}
		if err := recomputeAutomaticShowUpWithStore(opCtx, store, goal, entry.Date); err != nil {
			if errors.Is(err, errGoalDefinitionStale) {
				return errors.Join(err, cleanupStaleCompletion(opCtx, store, goal, entry))
			}
			return err
		}
		return nil
	}

	err := store.RunTransaction(ctx, operation)
	if errors.Is(err, errTransactionsUnavailable) {
		err = operation(ctx)
	}
	if err != nil {
		return models.GoalCompletion{}, err
	}
	current, checkErr := store.GoalDefinitionCurrent(ctx, goal, &entry.SubGoalID)
	if checkErr != nil {
		return models.GoalCompletion{}, checkErr
	}
	if !current {
		return models.GoalCompletion{}, errors.Join(errGoalDefinitionStale, cleanupStaleCompletion(ctx, store, goal, entry))
	}
	return saved, nil
}

func deleteGoalCompletionFenced(ctx context.Context, store goalActivityMutationStore, goal models.Goal, entry models.GoalCompletion) (bool, error) {
	var deleted bool
	operation := func(opCtx context.Context) error {
		current, err := store.GoalDefinitionCurrent(opCtx, goal, &entry.SubGoalID)
		if err != nil {
			return err
		}
		if !current {
			return errGoalDefinitionStale
		}
		deleted, err = store.DeleteGoalCompletion(opCtx, entry)
		if err != nil || !deleted {
			return err
		}
		current, err = store.GoalDefinitionCurrent(opCtx, goal, &entry.SubGoalID)
		if err != nil {
			return err
		}
		if !current {
			return errGoalDefinitionStale
		}
		return recomputeAutomaticShowUpWithStore(opCtx, store, goal, entry.Date)
	}

	err := store.RunTransaction(ctx, operation)
	if errors.Is(err, errTransactionsUnavailable) {
		err = operation(ctx)
	}
	if err != nil {
		return false, err
	}
	current, checkErr := store.GoalDefinitionCurrent(ctx, goal, &entry.SubGoalID)
	if checkErr != nil {
		return false, checkErr
	}
	if !current {
		_ = store.DeleteAutomaticShowUp(ctx, goal, entry.Date)
		return false, errGoalDefinitionStale
	}
	return deleted, nil
}

func (mongoGoalStore) FindAndDeleteShowUp(ctx context.Context, userID, goalID primitive.ObjectID, date string) (models.ShowUp, error) {
	var entry models.ShowUp
	err := config.DB.Collection(showUpsCollection).
		FindOneAndDelete(ctx, goalActivityFilter(userID, goalID, "date", date)).Decode(&entry)
	return entry, err
}

func (mongoGoalStore) RestoreShowUp(ctx context.Context, entry models.ShowUp) error {
	filter := goalActivityFilter(entry.UserID, entry.GoalID, "date", entry.Date)
	_, err := config.DB.Collection(showUpsCollection).UpdateOne(
		ctx, filter, bson.M{"$setOnInsert": entry}, options.Update().SetUpsert(true),
	)
	if mongo.IsDuplicateKeyError(err) {
		return nil
	}
	return err
}

func deleteShowUpAndRecompute(ctx context.Context, store goalMutationStore, goal models.Goal, date string) error {
	var deleted models.ShowUp
	operation := func(opCtx context.Context) error {
		entry, err := store.FindAndDeleteShowUp(opCtx, goal.UserID, goal.ID, date)
		if err != nil {
			return err
		}
		deleted = entry
		return store.RecomputeAutomaticShowUp(opCtx, goal, date)
	}
	if err := store.RunTransaction(ctx, operation); !errors.Is(err, errTransactionsUnavailable) {
		return err
	}

	entry, err := store.FindAndDeleteShowUp(ctx, goal.UserID, goal.ID, date)
	if err != nil {
		return err
	}
	deleted = entry
	if err := store.RecomputeAutomaticShowUp(ctx, goal, date); err != nil {
		if errors.Is(err, errGoalDefinitionStale) {
			return err
		}
		return errors.Join(err, store.RestoreShowUp(ctx, deleted))
	}
	return nil
}
