package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	goalsCollection           = "goals"
	goalCompletionsCollection = "goal_completions"
	showUpsCollection         = "show_ups"
	goalCheckInsCollection    = "goal_check_ins"
	goalDateLayout            = "2006-01-02"
	maxGoalRangeDays          = 366
	maxGoalItems              = 100
)

var (
	errGoalConflict        = errors.New("goal was updated by another request")
	errGoalDefinitionStale = errors.New("goal definition changed during activity write")
)

type subGoalInput struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed *bool  `json:"completed"`
}

type milestoneInput struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	TargetDate *string `json:"targetDate"`
	Completed  *bool   `json:"completed"`
}

type createGoalRequest struct {
	Title            string           `json:"title"`
	Description      string           `json:"description"`
	GridMode         string           `json:"gridMode"`
	CompletionPolicy string           `json:"completionPolicy"`
	StartDate        string           `json:"startDate"`
	TargetDate       *string          `json:"targetDate"`
	SubGoals         []subGoalInput   `json:"subGoals"`
	Milestones       []milestoneInput `json:"milestones"`
}

type patchGoalRequest struct {
	Title            *string           `json:"title"`
	Description      *string           `json:"description"`
	GridMode         *string           `json:"gridMode"`
	CompletionPolicy *string           `json:"completionPolicy"`
	StartDate        *string           `json:"startDate"`
	TargetDate       json.RawMessage   `json:"targetDate"`
	SubGoals         *[]subGoalInput   `json:"subGoals"`
	Milestones       *[]milestoneInput `json:"milestones"`
}

type goalActivityRequest struct {
	Status string `json:"status"`
	Source string `json:"source"`
	Note   string `json:"note"`
}

func goalOwnedFilter(goalID, userID primitive.ObjectID) bson.M {
	return bson.M{"_id": goalID, "userId": userID}
}

func activeGoalOwnedFilter(goalID, userID primitive.ObjectID) bson.M {
	filter := goalOwnedFilter(goalID, userID)
	filter["deleteState"] = bson.M{"$exists": false}
	return filter
}

func goalActivityFilter(userID, goalID primitive.ObjectID, dateField, date string) bson.M {
	return bson.M{"userId": userID, "goalId": goalID, dateField: date}
}

func automaticShowUpFilter(goal models.Goal, date string) bson.M {
	return bson.M{
		"userId": goal.UserID,
		"goalId": goal.ID,
		"date":   date,
		"source": bson.M{"$ne": models.GoalSourceManual},
		"$or": bson.A{
			bson.M{"definitionVersion": bson.M{"$lte": goal.DefinitionVersion}},
			bson.M{"definitionVersion": bson.M{"$exists": false}},
		},
	}
}

func validSubGoalIDs(goal models.Goal) []primitive.ObjectID {
	ids := make([]primitive.ObjectID, len(goal.SubGoals))
	for i := range goal.SubGoals {
		ids[i] = goal.SubGoals[i].ID
	}
	return ids
}

func currentCompletionFilter(goal models.Goal) bson.M {
	return bson.M{
		"userId":            goal.UserID,
		"goalId":            goal.ID,
		"definitionVersion": goal.DefinitionVersion,
		"subGoalId":         bson.M{"$in": validSubGoalIDs(goal)},
	}
}

func currentShowUpPredicate(goal models.Goal) bson.M {
	return bson.M{"$or": bson.A{
		bson.M{"source": bson.M{"$ne": models.GoalSourceAutomatic}},
		bson.M{"source": models.GoalSourceAutomatic, "definitionVersion": goal.DefinitionVersion},
	}}
}

func currentShowUpFilter(goal models.Goal) bson.M {
	filter := bson.M{"userId": goal.UserID, "goalId": goal.ID}
	for key, value := range currentShowUpPredicate(goal) {
		filter[key] = value
	}
	return filter
}

func completionBelongsToCurrentDefinition(goal models.Goal, entry models.GoalCompletion) bool {
	return entry.DefinitionVersion == goal.DefinitionVersion && findSubGoal(goal, entry.SubGoalID)
}

func showUpBelongsToCurrentDefinition(goal models.Goal, entry models.ShowUp) bool {
	return entry.Source != models.GoalSourceAutomatic || entry.DefinitionVersion == goal.DefinitionVersion
}

func parseDateOnly(value string) (time.Time, error) {
	return parseDateOnlyInLocation(value, time.UTC)
}

func parseGoalRange(from, to string) (time.Time, time.Time, error) {
	return parseGoalRangeInLocation(from, to, time.UTC)
}

func textField(value, name string, minRunes, maxRunes int) (string, error) {
	value = strings.TrimSpace(value)
	length := utf8.RuneCountInString(value)
	if length < minRunes || length > maxRunes {
		if minRunes == 0 {
			return "", fmt.Errorf("%s cannot exceed %d characters", name, maxRunes)
		}
		return "", fmt.Errorf("%s must be between %d and %d characters", name, minRunes, maxRunes)
	}
	return value, nil
}

func buildSubGoals(inputs []subGoalInput, now time.Time) ([]models.SubGoal, error) {
	if len(inputs) > maxGoalItems {
		return nil, fmt.Errorf("subGoals cannot contain more than %d items", maxGoalItems)
	}
	items := make([]models.SubGoal, 0, len(inputs))
	seen := map[primitive.ObjectID]struct{}{}
	for position, input := range inputs {
		title, err := textField(input.Title, "sub-goal title", 1, 300)
		if err != nil {
			return nil, err
		}
		id := primitive.NewObjectID()
		if input.ID != "" {
			id, err = primitive.ObjectIDFromHex(input.ID)
			if err != nil {
				return nil, fmt.Errorf("invalid sub-goal ID")
			}
		}
		if _, exists := seen[id]; exists {
			return nil, fmt.Errorf("duplicate sub-goal ID")
		}
		seen[id] = struct{}{}
		completed := input.Completed != nil && *input.Completed
		var completedAt *time.Time
		if completed {
			value := now
			completedAt = &value
		}
		items = append(items, models.SubGoal{ID: id, Title: title, Position: position, Completed: completed, CompletedAt: completedAt})
	}
	return items, nil
}

func buildMilestones(inputs []milestoneInput, now time.Time) ([]models.Milestone, error) {
	if len(inputs) > maxGoalItems {
		return nil, fmt.Errorf("milestones cannot contain more than %d items", maxGoalItems)
	}
	items := make([]models.Milestone, 0, len(inputs))
	seen := map[primitive.ObjectID]struct{}{}
	for position, input := range inputs {
		title, err := textField(input.Title, "milestone title", 1, 300)
		if err != nil {
			return nil, err
		}
		id := primitive.NewObjectID()
		if input.ID != "" {
			id, err = primitive.ObjectIDFromHex(input.ID)
			if err != nil {
				return nil, fmt.Errorf("invalid milestone ID")
			}
		}
		if _, exists := seen[id]; exists {
			return nil, fmt.Errorf("duplicate milestone ID")
		}
		seen[id] = struct{}{}
		completed := input.Completed != nil && *input.Completed
		var completedAt *time.Time
		if completed {
			value := now
			completedAt = &value
		}
		items = append(items, models.Milestone{ID: id, Title: title, Position: position, TargetDate: input.TargetDate, Completed: completed, CompletedAt: completedAt})
	}
	return items, nil
}

func validateGoal(goal *models.Goal) error {
	var err error
	goal.Title, err = textField(goal.Title, "title", 1, 200)
	if err != nil {
		return err
	}
	goal.Description, err = textField(goal.Description, "description", 0, 2000)
	if err != nil {
		return err
	}
	if goal.GridMode != models.GoalGridDaily && goal.GridMode != models.GoalGridWeekly {
		return fmt.Errorf("gridMode must be daily or weekly")
	}
	if goal.CompletionPolicy != models.GoalCompletionAuto && goal.CompletionPolicy != models.GoalCompletionManual {
		return fmt.Errorf("completionPolicy must be auto or manual")
	}
	start, err := parseDateOnly(goal.StartDate)
	if err != nil {
		return fmt.Errorf("invalid startDate")
	}
	var target *time.Time
	if goal.TargetDate != nil {
		value, err := parseDateOnly(*goal.TargetDate)
		if err != nil {
			return fmt.Errorf("invalid targetDate")
		}
		if value.Before(start) {
			return fmt.Errorf("targetDate must not be before startDate")
		}
		target = &value
	}
	if len(goal.SubGoals) > maxGoalItems || len(goal.Milestones) > maxGoalItems {
		return fmt.Errorf("goals support at most %d sub-goals and milestones", maxGoalItems)
	}
	if goal.CompletionPolicy == models.GoalCompletionAuto && len(goal.SubGoals) == 0 {
		return fmt.Errorf("auto completion requires at least one sub-goal")
	}
	seenSubGoals := map[primitive.ObjectID]struct{}{}
	for i := range goal.SubGoals {
		item := &goal.SubGoals[i]
		if item.ID.IsZero() {
			return fmt.Errorf("sub-goal ID is required")
		}
		if _, exists := seenSubGoals[item.ID]; exists {
			return fmt.Errorf("duplicate sub-goal ID")
		}
		seenSubGoals[item.ID] = struct{}{}
		item.Title, err = textField(item.Title, "sub-goal title", 1, 300)
		if err != nil {
			return err
		}
		item.Position = i
	}
	seenMilestones := map[primitive.ObjectID]struct{}{}
	for i := range goal.Milestones {
		item := &goal.Milestones[i]
		if item.ID.IsZero() {
			return fmt.Errorf("milestone ID is required")
		}
		if _, exists := seenMilestones[item.ID]; exists {
			return fmt.Errorf("duplicate milestone ID")
		}
		seenMilestones[item.ID] = struct{}{}
		item.Title, err = textField(item.Title, "milestone title", 1, 300)
		if err != nil {
			return err
		}
		item.Position = i
		if item.TargetDate != nil {
			milestoneDate, err := parseDateOnly(*item.TargetDate)
			if err != nil {
				return fmt.Errorf("invalid milestone targetDate")
			}
			if milestoneDate.Before(start) || (target != nil && milestoneDate.After(*target)) {
				return fmt.Errorf("milestone targetDate must be within the goal timeline")
			}
		}
	}
	return nil
}

func normalizeGoal(goal *models.Goal) {
	if goal.SubGoals == nil {
		goal.SubGoals = []models.SubGoal{}
	}
	if goal.Milestones == nil {
		goal.Milestones = []models.Milestone{}
	}
	sort.SliceStable(goal.SubGoals, func(i, j int) bool { return goal.SubGoals[i].Position < goal.SubGoals[j].Position })
	sort.SliceStable(goal.Milestones, func(i, j int) bool { return goal.Milestones[i].Position < goal.Milestones[j].Position })
}

func applyAutoCompletion(goal *models.Goal, now time.Time) {
	if goal.CompletionPolicy != models.GoalCompletionAuto || goal.Status == models.GoalStatusArchived {
		return
	}
	allDone := len(goal.SubGoals) > 0
	for _, item := range goal.SubGoals {
		allDone = allDone && item.Completed
	}
	for _, item := range goal.Milestones {
		allDone = allDone && item.Completed
	}
	if allDone {
		goal.Status = models.GoalStatusCompleted
		if goal.CompletedAt == nil {
			value := now
			goal.CompletedAt = &value
		}
		return
	}
	if goal.Status == models.GoalStatusCompleted {
		goal.Status = models.GoalStatusActive
		goal.CompletedAt = nil
	}
}

func goalIDParam(c *fiber.Ctx) (primitive.ObjectID, error) {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return primitive.NilObjectID, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid goal ID"})
	}
	return id, nil
}

func loadOwnedGoal(ctx context.Context, goalID, userID primitive.ObjectID) (models.Goal, error) {
	var goal models.Goal
	err := config.DB.Collection(goalsCollection).FindOne(ctx, activeGoalOwnedFilter(goalID, userID)).Decode(&goal)
	normalizeGoal(&goal)
	return goal, err
}

func sendGoalNotFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Goal not found"})
}

func definitionVersionFilter(version int64) bson.M {
	if version != 0 {
		return bson.M{"definitionVersion": version}
	}
	return bson.M{"$or": bson.A{
		bson.M{"definitionVersion": int64(0)},
		bson.M{"definitionVersion": bson.M{"$exists": false}},
	}}
}

func saveGoalDefinition(ctx context.Context, originalUpdatedAt time.Time, originalDefinitionVersion int64, goal *models.Goal) error {
	filter := bson.M{"_id": goal.ID, "userId": goal.UserID, "updatedAt": originalUpdatedAt, "deleteState": bson.M{"$exists": false}}
	for key, value := range definitionVersionFilter(originalDefinitionVersion) {
		filter[key] = value
	}
	set := bson.M{
		"title": goal.Title, "description": goal.Description, "gridMode": goal.GridMode,
		"completionPolicy": goal.CompletionPolicy, "startDate": goal.StartDate, "targetDate": goal.TargetDate,
		"subGoals": goal.SubGoals, "milestones": goal.Milestones, "status": goal.Status,
		"completedAt": goal.CompletedAt, "archivedAt": goal.ArchivedAt, "updatedAt": goal.UpdatedAt,
	}
	update := bson.M{"$set": set}
	switch goal.DefinitionVersion {
	case originalDefinitionVersion:
	case originalDefinitionVersion + 1:
		update["$inc"] = bson.M{"definitionVersion": int64(1)}
	default:
		return fmt.Errorf("invalid definition version transition: %d to %d", originalDefinitionVersion, goal.DefinitionVersion)
	}
	result, err := config.DB.Collection(goalsCollection).UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errGoalConflict
	}
	return nil
}

func incrementDefinitionVersion(goal *models.Goal) {
	goal.DefinitionVersion++
}

func sendGoalDefinitionStale(c *fiber.Ctx) error {
	return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Goal definition changed; refresh and try again"})
}

func verifyLoadedGoalDefinition(ctx context.Context, goal models.Goal) error {
	current, err := currentGoalActivityStore().GoalDefinitionCurrent(ctx, goal, nil)
	if err != nil {
		return err
	}
	if !current {
		return errGoalDefinitionStale
	}
	return nil
}

func verifyGoalActivityWrite(ctx context.Context, goal models.Goal, collection string, entryID primitive.ObjectID) error {
	if err := verifyLoadedGoalDefinition(ctx, goal); err != nil {
		cleanupFilter := bson.M{"_id": entryID, "userId": goal.UserID, "goalId": goal.ID}
		_, cleanupErr := config.DB.Collection(collection).DeleteOne(ctx, cleanupFilter)
		return errors.Join(err, cleanupErr)
	}
	return nil
}
func sendGoalSaveError(c *fiber.Ctx, err error) error {
	if errors.Is(err, errGoalConflict) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Goal changed; refresh and try again"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save goal"})
}

func CreateGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var req createGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	now := goalNow().UTC()
	for i := range req.SubGoals {
		req.SubGoals[i].ID = ""
	}
	for i := range req.Milestones {
		req.Milestones[i].ID = ""
	}
	subGoals, err := buildSubGoals(req.SubGoals, now)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	milestones, err := buildMilestones(req.Milestones, now)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	goal := models.Goal{
		ID: primitive.NewObjectID(), UserID: user.ID, DefinitionVersion: 1, Title: req.Title, Description: req.Description,
		Status: models.GoalStatusActive, GridMode: req.GridMode, CompletionPolicy: req.CompletionPolicy,
		StartDate: req.StartDate, TargetDate: req.TargetDate, SubGoals: subGoals, Milestones: milestones,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := validateGoal(&goal); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	applyAutoCompletion(&goal, now)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := config.DB.Collection(goalsCollection).InsertOne(ctx, goal); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create goal"})
	}
	return c.Status(fiber.StatusCreated).JSON(goal)
}

func GetGoals(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	filter := bson.M{"userId": user.ID, "deleteState": bson.M{"$exists": false}}
	if status := c.Query("status"); status != "" {
		if status != models.GoalStatusActive && status != models.GoalStatusCompleted && status != models.GoalStatusArchived {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid status"})
		}
		filter["status"] = status
	}
	limit, err := strconv.Atoi(c.Query("limit", "50"))
	if err != nil || limit < 1 || limit > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "limit must be between 1 and 100"})
	}
	offset, err := strconv.Atoi(c.Query("offset", "0"))
	if err != nil || offset < 0 || offset > 10000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "offset must be between 0 and 10000"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cursor, err := config.DB.Collection(goalsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}}).SetSkip(int64(offset)).SetLimit(int64(limit)))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goals"})
	}
	defer cursor.Close(ctx)
	var goals []models.Goal
	if err := cursor.All(ctx, &goals); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse goals"})
	}
	if goals == nil {
		goals = []models.Goal{}
	}
	for i := range goals {
		normalizeGoal(&goals[i])
	}
	return c.JSON(goals)
}

func GetGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return responseErr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return sendGoalNotFound(c)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	return c.JSON(goal)
}

func PatchGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return responseErr
	}
	var req patchGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return sendGoalNotFound(c)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	originalUpdatedAt := goal.UpdatedAt
	originalDefinitionVersion := goal.DefinitionVersion
	now := goalNow().UTC()
	if req.Title != nil {
		goal.Title = *req.Title
	}
	if req.Description != nil {
		goal.Description = *req.Description
	}
	if req.GridMode != nil {
		goal.GridMode = *req.GridMode
	}
	if req.CompletionPolicy != nil {
		goal.CompletionPolicy = *req.CompletionPolicy
	}
	if req.StartDate != nil {
		goal.StartDate = *req.StartDate
	}
	if len(req.TargetDate) > 0 {
		if string(req.TargetDate) == "null" {
			goal.TargetDate = nil
		} else {
			var value string
			if err := json.Unmarshal(req.TargetDate, &value); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "targetDate must be a date or null"})
			}
			goal.TargetDate = &value
		}
	}
	if req.SubGoals != nil {
		goal.SubGoals, err = buildSubGoals(*req.SubGoals, now)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
	}
	if req.Milestones != nil {
		goal.Milestones, err = buildMilestones(*req.Milestones, now)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
	}
	if err := validateGoal(&goal); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	applyAutoCompletion(&goal, now)
	goal.UpdatedAt = now
	if req.SubGoals != nil {
		incrementDefinitionVersion(&goal)
		if err := saveSubGoalDefinition(ctx, currentGoalMutationStore(), originalUpdatedAt, originalDefinitionVersion, &goal); err != nil {
			return sendGoalSaveError(c, err)
		}
	} else if err := saveGoalDefinition(ctx, originalUpdatedAt, originalDefinitionVersion, &goal); err != nil {
		return sendGoalSaveError(c, err)
	}
	return c.JSON(goal)
}

func DeleteGoal(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return responseErr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := deleteGoalWithStore(ctx, currentGoalDeletionStore(), user.ID, goalID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return sendGoalNotFound(c)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete goal"})
	}
	if result.CleanupPending {
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"status":         "cleanup_pending",
			"cleanupPending": true,
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func applyGoalTransition(goal *models.Goal, transition string, now time.Time) error {
	switch transition {
	case models.GoalStatusCompleted:
		if goal.CompletionPolicy == models.GoalCompletionAuto {
			return fmt.Errorf("auto-completion goals cannot be completed manually")
		}
		if goal.Status != models.GoalStatusActive {
			return fmt.Errorf("only active goals can be completed")
		}
		goal.Status, goal.CompletedAt = models.GoalStatusCompleted, &now
	case models.GoalStatusArchived:
		if goal.Status == models.GoalStatusArchived {
			return fmt.Errorf("goal is already archived")
		}
		goal.Status, goal.ArchivedAt = models.GoalStatusArchived, &now
	case models.GoalStatusActive:
		if goal.Status != models.GoalStatusArchived {
			return fmt.Errorf("only archived goals can be restored")
		}
		goal.Status, goal.ArchivedAt, goal.CompletedAt = models.GoalStatusActive, nil, nil
		applyAutoCompletion(goal, now)
	default:
		return fmt.Errorf("invalid goal transition")
	}
	return nil
}

func transitionGoal(c *fiber.Ctx, transition string) error {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return responseErr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return sendGoalNotFound(c)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	originalUpdatedAt := goal.UpdatedAt
	originalDefinitionVersion := goal.DefinitionVersion
	now := goalNow().UTC()
	if err := applyGoalTransition(&goal, transition, now); err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	goal.UpdatedAt = now
	if err := saveGoalDefinition(ctx, originalUpdatedAt, originalDefinitionVersion, &goal); err != nil {
		return sendGoalSaveError(c, err)
	}
	return c.JSON(goal)
}

func CompleteGoal(c *fiber.Ctx) error { return transitionGoal(c, models.GoalStatusCompleted) }
func ArchiveGoal(c *fiber.Ctx) error  { return transitionGoal(c, models.GoalStatusArchived) }
func RestoreGoal(c *fiber.Ctx) error  { return transitionGoal(c, models.GoalStatusActive) }

func loadGoalForDefinitionMutation(c *fiber.Ctx) (context.Context, context.CancelFunc, models.Goal, error) {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return nil, func() {}, models.Goal{}, responseErr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ctx, cancel, goal, sendGoalNotFound(c)
	}
	if err != nil {
		return ctx, cancel, goal, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	return ctx, cancel, goal, nil
}

func finishDefinitionMutation(c *fiber.Ctx, ctx context.Context, goal *models.Goal, originalUpdatedAt time.Time, subGoalsChanged bool) error {
	now := goalNow().UTC()
	if err := validateGoal(goal); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	applyAutoCompletion(goal, now)
	goal.UpdatedAt = now
	originalDefinitionVersion := goal.DefinitionVersion
	if subGoalsChanged {
		incrementDefinitionVersion(goal)
		if err := saveSubGoalDefinition(ctx, currentGoalMutationStore(), originalUpdatedAt, originalDefinitionVersion, goal); err != nil {
			return sendGoalSaveError(c, err)
		}
	} else if err := saveGoalDefinition(ctx, originalUpdatedAt, originalDefinitionVersion, goal); err != nil {
		return sendGoalSaveError(c, err)
	}
	return c.JSON(goal)
}

func AddSubGoal(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	var req struct {
		Title string `json:"title"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	title, err := textField(req.Title, "sub-goal title", 1, 300)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if len(goal.SubGoals) >= maxGoalItems {
		return c.Status(400).JSON(fiber.Map{"error": "Too many sub-goals"})
	}
	original := goal.UpdatedAt
	goal.SubGoals = append(goal.SubGoals, models.SubGoal{ID: primitive.NewObjectID(), Title: title, Position: len(goal.SubGoals)})
	return finishDefinitionMutation(c, ctx, &goal, original, true)
}

func UpdateSubGoal(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	itemID, parseErr := primitive.ObjectIDFromHex(c.Params("subGoalId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid sub-goal ID"})
	}
	var req struct {
		Title     *string `json:"title"`
		Completed *bool   `json:"completed"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	index := -1
	for i := range goal.SubGoals {
		if goal.SubGoals[i].ID == itemID {
			index = i
			break
		}
	}
	if index < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Sub-goal not found"})
	}
	original, now := goal.UpdatedAt, goalNow().UTC()
	if req.Title != nil {
		goal.SubGoals[index].Title = *req.Title
	}
	if req.Completed != nil {
		goal.SubGoals[index].Completed = *req.Completed
		if *req.Completed {
			goal.SubGoals[index].CompletedAt = &now
		} else {
			goal.SubGoals[index].CompletedAt = nil
		}
	}
	return finishDefinitionMutation(c, ctx, &goal, original, req.Title != nil || req.Completed != nil)
}

func DeleteSubGoal(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	itemID, parseErr := primitive.ObjectIDFromHex(c.Params("subGoalId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid sub-goal ID"})
	}
	index := -1
	for i := range goal.SubGoals {
		if goal.SubGoals[i].ID == itemID {
			index = i
			break
		}
	}
	if index < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Sub-goal not found"})
	}
	original := goal.UpdatedAt
	goal.SubGoals = append(goal.SubGoals[:index], goal.SubGoals[index+1:]...)
	now := goalNow().UTC()
	if err := validateGoal(&goal); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	applyAutoCompletion(&goal, now)
	goal.UpdatedAt = now
	originalDefinitionVersion := goal.DefinitionVersion
	incrementDefinitionVersion(&goal)
	if err := saveSubGoalDefinition(ctx, currentGoalMutationStore(), original, originalDefinitionVersion, &goal); err != nil {
		return sendGoalSaveError(c, err)
	}
	return c.JSON(goal)
}

func reorderObjectIDs(raw []string, current []primitive.ObjectID) (map[primitive.ObjectID]int, error) {
	if len(raw) != len(current) {
		return nil, fmt.Errorf("orderedIds must contain every item exactly once")
	}
	expected := map[primitive.ObjectID]struct{}{}
	for _, id := range current {
		expected[id] = struct{}{}
	}
	positions := map[primitive.ObjectID]int{}
	for i, value := range raw {
		id, err := primitive.ObjectIDFromHex(value)
		if err != nil {
			return nil, fmt.Errorf("invalid item ID")
		}
		if _, ok := expected[id]; !ok {
			return nil, fmt.Errorf("orderedIds contains an unknown item")
		}
		if _, duplicate := positions[id]; duplicate {
			return nil, fmt.Errorf("orderedIds contains a duplicate item")
		}
		positions[id] = i
	}
	return positions, nil
}

func ReorderSubGoals(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	var req struct {
		OrderedIDs []string `json:"orderedIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	ids := make([]primitive.ObjectID, len(goal.SubGoals))
	for i := range goal.SubGoals {
		ids[i] = goal.SubGoals[i].ID
	}
	positions, err := reorderObjectIDs(req.OrderedIDs, ids)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	original := goal.UpdatedAt
	sort.Slice(goal.SubGoals, func(i, j int) bool { return positions[goal.SubGoals[i].ID] < positions[goal.SubGoals[j].ID] })
	return finishDefinitionMutation(c, ctx, &goal, original, true)
}

func AddMilestone(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	var req milestoneInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	req.ID = ""
	items, err := buildMilestones([]milestoneInput{req}, goalNow().UTC())
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if len(goal.Milestones) >= maxGoalItems {
		return c.Status(400).JSON(fiber.Map{"error": "Too many milestones"})
	}
	original := goal.UpdatedAt
	items[0].Position = len(goal.Milestones)
	goal.Milestones = append(goal.Milestones, items[0])
	return finishDefinitionMutation(c, ctx, &goal, original, false)
}

func UpdateMilestone(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	itemID, parseErr := primitive.ObjectIDFromHex(c.Params("milestoneId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid milestone ID"})
	}
	var req struct {
		Title      *string         `json:"title"`
		TargetDate json.RawMessage `json:"targetDate"`
		Completed  *bool           `json:"completed"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	index := -1
	for i := range goal.Milestones {
		if goal.Milestones[i].ID == itemID {
			index = i
			break
		}
	}
	if index < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Milestone not found"})
	}
	original, now := goal.UpdatedAt, goalNow().UTC()
	if req.Title != nil {
		goal.Milestones[index].Title = *req.Title
	}
	if len(req.TargetDate) > 0 {
		if string(req.TargetDate) == "null" {
			goal.Milestones[index].TargetDate = nil
		} else {
			var v string
			if json.Unmarshal(req.TargetDate, &v) != nil {
				return c.Status(400).JSON(fiber.Map{"error": "targetDate must be a date or null"})
			}
			goal.Milestones[index].TargetDate = &v
		}
	}
	if req.Completed != nil {
		goal.Milestones[index].Completed = *req.Completed
		if *req.Completed {
			goal.Milestones[index].CompletedAt = &now
		} else {
			goal.Milestones[index].CompletedAt = nil
		}
	}
	return finishDefinitionMutation(c, ctx, &goal, original, false)
}

func DeleteMilestone(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	itemID, parseErr := primitive.ObjectIDFromHex(c.Params("milestoneId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid milestone ID"})
	}
	index := -1
	for i := range goal.Milestones {
		if goal.Milestones[i].ID == itemID {
			index = i
			break
		}
	}
	if index < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Milestone not found"})
	}
	original := goal.UpdatedAt
	goal.Milestones = append(goal.Milestones[:index], goal.Milestones[index+1:]...)
	return finishDefinitionMutation(c, ctx, &goal, original, false)
}

func ReorderMilestones(c *fiber.Ctx) error {
	ctx, cancel, goal, err := loadGoalForDefinitionMutation(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	var req struct {
		OrderedIDs []string `json:"orderedIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	ids := make([]primitive.ObjectID, len(goal.Milestones))
	for i := range goal.Milestones {
		ids[i] = goal.Milestones[i].ID
	}
	positions, err := reorderObjectIDs(req.OrderedIDs, ids)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	original := goal.UpdatedAt
	sort.Slice(goal.Milestones, func(i, j int) bool { return positions[goal.Milestones[i].ID] < positions[goal.Milestones[j].ID] })
	return finishDefinitionMutation(c, ctx, &goal, original, false)
}

func validateActivityWrite(goal models.Goal, date string, location *time.Location, now time.Time) error {
	if goal.Status != models.GoalStatusActive {
		return fmt.Errorf("activity can only be changed for active goals")
	}
	value, err := parseDateOnlyInLocation(date, location)
	if err != nil {
		return fmt.Errorf("invalid activity date")
	}
	today := localGoalDay(now, location)
	if value.After(today) {
		return fmt.Errorf("activity date cannot be in the future")
	}
	start, _ := parseDateOnlyInLocation(goal.StartDate, location)
	if value.Before(start) {
		return fmt.Errorf("activity date is before the goal starts")
	}
	if goal.TargetDate != nil {
		target, _ := parseDateOnlyInLocation(*goal.TargetDate, location)
		if value.After(target) {
			return fmt.Errorf("activity date is after the goal target")
		}
	}
	if goal.GridMode == models.GoalGridWeekly && value.Weekday() != time.Monday {
		return fmt.Errorf("weekly activity dates must be Mondays")
	}
	return nil
}

func validateActivityRequest(req *goalActivityRequest) error {
	if req.Status != models.GoalActivityComplete && req.Status != models.GoalActivityPartial {
		return fmt.Errorf("status must be complete or partial")
	}
	if req.Source != "" && req.Source != models.GoalSourceManual {
		return fmt.Errorf("client activity source must be manual")
	}
	var err error
	req.Note, err = textField(req.Note, "note", 0, 2000)
	return err
}

func findSubGoal(goal models.Goal, id primitive.ObjectID) bool {
	for _, item := range goal.SubGoals {
		if item.ID == id {
			return true
		}
	}
	return false
}

func loadActivityGoal(c *fiber.Ctx) (context.Context, context.CancelFunc, models.Goal, primitive.ObjectID, error) {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return nil, func() {}, models.Goal{}, primitive.NilObjectID, responseErr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ctx, cancel, goal, goalID, sendGoalNotFound(c)
	}
	if err != nil {
		return ctx, cancel, goal, goalID, c.Status(500).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	return ctx, cancel, goal, goalID, nil
}

func automaticShowUpState(goal models.Goal, existing *models.ShowUp, entries []models.GoalCompletion) (status string, write bool, preserveManual bool) {
	if existing != nil && existing.Source == models.GoalSourceManual {
		return "", false, true
	}

	validIDs := make(map[primitive.ObjectID]struct{}, len(goal.SubGoals))
	for _, subGoal := range goal.SubGoals {
		validIDs[subGoal.ID] = struct{}{}
	}
	completedIDs := make(map[primitive.ObjectID]struct{}, len(validIDs))
	for _, entry := range entries {
		if entry.DefinitionVersion != goal.DefinitionVersion {
			continue
		}
		if _, valid := validIDs[entry.SubGoalID]; !valid {
			continue
		}
		if entry.Status == models.GoalActivityComplete {
			completedIDs[entry.SubGoalID] = struct{}{}
		}
	}
	if len(completedIDs) == 0 {
		return "", false, false
	}
	if len(validIDs) > 0 && len(completedIDs) == len(validIDs) {
		return models.GoalActivityComplete, true, false
	}
	return models.GoalActivityPartial, true, false
}

func recomputeAutomaticShowUp(ctx context.Context, goal models.Goal, date string) error {
	return recomputeAutomaticShowUpWithStore(ctx, currentGoalActivityStore(), goal, date)
}

func PutGoalCompletion(c *fiber.Ctx) error {
	ctx, cancel, goal, _, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	subGoalID, parseErr := primitive.ObjectIDFromHex(c.Params("subGoalId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid sub-goal ID"})
	}
	if !findSubGoal(goal, subGoalID) {
		return c.Status(404).JSON(fiber.Map{"error": "Sub-goal not found"})
	}
	date := c.Params("date")
	if err := validateActivityWrite(goal, date, goalRequestLocation(c, c.Locals("user").(models.User)), goalNow()); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	var req goalActivityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := validateActivityRequest(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	now := goalNow().UTC()
	entry := models.GoalCompletion{
		ID: primitive.NewObjectID(), UserID: goal.UserID, GoalID: goal.ID,
		SubGoalID: subGoalID, DefinitionVersion: goal.DefinitionVersion,
		Date: date, Status: req.Status, Source: models.GoalSourceManual,
		Note: req.Note, CreatedAt: now, UpdatedAt: now,
	}
	saved, err := putGoalCompletionFenced(ctx, currentGoalActivityStore(), goal, entry)
	if errors.Is(err, errGoalDefinitionStale) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Goal definition changed; refresh and try again"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save completion or update show-up"})
	}
	return c.JSON(saved)
}

func DeleteGoalCompletion(c *fiber.Ctx) error {
	ctx, cancel, goal, _, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	subGoalID, parseErr := primitive.ObjectIDFromHex(c.Params("subGoalId"))
	if parseErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid sub-goal ID"})
	}
	if !findSubGoal(goal, subGoalID) {
		return c.Status(404).JSON(fiber.Map{"error": "Sub-goal not found"})
	}
	date := c.Params("date")
	if err := validateActivityWrite(goal, date, goalRequestLocation(c, c.Locals("user").(models.User)), goalNow()); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	entry := models.GoalCompletion{
		UserID: goal.UserID, GoalID: goal.ID, SubGoalID: subGoalID,
		DefinitionVersion: goal.DefinitionVersion, Date: date,
	}
	deleted, err := deleteGoalCompletionFenced(ctx, currentGoalActivityStore(), goal, entry)
	if errors.Is(err, errGoalDefinitionStale) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Goal definition changed; refresh and try again"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to clear completion or update show-up"})
	}
	if !deleted {
		return c.Status(404).JSON(fiber.Map{"error": "Completion not found"})
	}
	return c.SendStatus(204)
}

func rangeFilterForGoal(c *fiber.Ctx, goalID, userID primitive.ObjectID, dateField string) (bson.M, error) {
	from, to := c.Query("from"), c.Query("to")
	location := goalRequestLocation(c, c.Locals("user").(models.User))
	start, _, err := parseGoalRangeInLocation(from, to, location)
	if err != nil {
		return nil, err
	}
	if dateField == "weekStart" {
		from = mondayOnOrBefore(start).Format(goalDateLayout)
	}
	return bson.M{"userId": userID, "goalId": goalID, dateField: bson.M{"$gte": from, "$lte": to}}, nil
}

func GetGoalCompletions(c *fiber.Ctx) error {
	ctx, cancel, goal, goalID, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	user := c.Locals("user").(models.User)
	filter, err := rangeFilterForGoal(c, goalID, user.ID, "date")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	for key, value := range currentCompletionFilter(goal) {
		filter[key] = value
	}
	cursor, err := config.DB.Collection(goalCompletionsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "subGoalId", Value: 1}}))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch completions"})
	}
	defer cursor.Close(ctx)
	var entries []models.GoalCompletion
	if err := cursor.All(ctx, &entries); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse completions"})
	}
	if err := verifyLoadedGoalDefinition(ctx, goal); errors.Is(err, errGoalDefinitionStale) {
		return sendGoalDefinitionStale(c)
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to verify completion definition"})
	}
	if entries == nil {
		entries = []models.GoalCompletion{}
	}
	return c.JSON(entries)
}

func PutShowUp(c *fiber.Ctx) error {
	ctx, cancel, goal, _, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	date := c.Params("date")
	if err := validateActivityWrite(goal, date, goalRequestLocation(c, c.Locals("user").(models.User)), goalNow()); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	var req goalActivityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := validateActivityRequest(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	entry, err := saveManualShowUp(ctx, goal, date, req.Status, req.Note)
	if mongo.IsDuplicateKeyError(err) {
		return c.Status(409).JSON(fiber.Map{"error": "Show-up already exists"})
	}
	if errors.Is(err, errGoalConflict) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Show-up changed; retry"})
	}
	if errors.Is(err, errGoalDefinitionStale) {
		return sendGoalDefinitionStale(c)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save show-up"})
	}
	return c.JSON(entry)
}

func DeleteShowUp(c *fiber.Ctx) error {
	ctx, cancel, goal, _, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	date := c.Params("date")
	if err := validateActivityWrite(goal, date, goalRequestLocation(c, c.Locals("user").(models.User)), goalNow()); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if err := deleteShowUpAndRecompute(ctx, currentGoalMutationStore(), goal, date); errors.Is(err, mongo.ErrNoDocuments) {
		return c.Status(404).JSON(fiber.Map{"error": "Show-up not found"})
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to clear show-up"})
	}
	return c.SendStatus(204)
}

func GetShowUps(c *fiber.Ctx) error {
	ctx, cancel, goal, goalID, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	user := c.Locals("user").(models.User)
	filter, err := rangeFilterForGoal(c, goalID, user.ID, "date")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	for key, value := range currentShowUpPredicate(goal) {
		filter[key] = value
	}
	cursor, err := config.DB.Collection(showUpsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}}))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch show-ups"})
	}
	defer cursor.Close(ctx)
	var entries []models.ShowUp
	if err := cursor.All(ctx, &entries); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse show-ups"})
	}
	if err := verifyLoadedGoalDefinition(ctx, goal); errors.Is(err, errGoalDefinitionStale) {
		return sendGoalDefinitionStale(c)
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to verify show-up definition"})
	}
	if entries == nil {
		entries = []models.ShowUp{}
	}
	return c.JSON(entries)
}

func PutGoalCheckIn(c *fiber.Ctx) error {
	ctx, cancel, goal, goalID, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	weekStart := c.Params("weekStart")
	location := goalRequestLocation(c, c.Locals("user").(models.User))
	parsed, parseErr := parseDateOnlyInLocation(weekStart, location)
	if parseErr != nil || parsed.Weekday() != time.Monday {
		return c.Status(400).JSON(fiber.Map{"error": "weekStart must be a Monday in YYYY-MM-DD format"})
	}
	if parsed.After(mondayOnOrBefore(localGoalDay(goalNow(), location))) {
		return c.Status(400).JSON(fiber.Map{"error": "weekStart cannot be in the future"})
	}
	if goal.Status != models.GoalStatusActive {
		return c.Status(409).JSON(fiber.Map{"error": "Check-ins can only be changed for active goals"})
	}
	start, _ := parseDateOnlyInLocation(goal.StartDate, location)
	if parsed.AddDate(0, 0, 6).Before(start) {
		return c.Status(400).JSON(fiber.Map{"error": "weekStart is before the goal timeline"})
	}
	if goal.TargetDate != nil {
		target, _ := parseDateOnlyInLocation(*goal.TargetDate, location)
		if parsed.After(target) {
			return c.Status(400).JSON(fiber.Map{"error": "weekStart is after the goal timeline"})
		}
	}
	var req struct {
		TargetMomentum int    `json:"targetMomentum"`
		Reflection     string `json:"reflection"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.TargetMomentum < 0 || req.TargetMomentum > 100 {
		return c.Status(400).JSON(fiber.Map{"error": "targetMomentum must be between 0 and 100"})
	}
	req.Reflection, err = textField(req.Reflection, "reflection", 0, 5000)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	user := c.Locals("user").(models.User)
	filter := goalActivityFilter(user.ID, goalID, "weekStart", weekStart)
	now := goalNow().UTC()
	update := bson.M{"$set": bson.M{"targetMomentum": req.TargetMomentum, "reflection": req.Reflection, "updatedAt": now}, "$setOnInsert": bson.M{"_id": primitive.NewObjectID(), "userId": user.ID, "goalId": goalID, "weekStart": weekStart, "createdAt": now}}
	var entry models.GoalCheckIn
	err = config.DB.Collection(goalCheckInsCollection).FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)).Decode(&entry)
	if mongo.IsDuplicateKeyError(err) {
		return c.Status(409).JSON(fiber.Map{"error": "Check-in already exists"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save check-in"})
	}
	if err := verifyGoalActivityWrite(ctx, goal, goalCheckInsCollection, entry.ID); errors.Is(err, errGoalDefinitionStale) {
		return sendGoalDefinitionStale(c)
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to verify check-in write"})
	}
	return c.JSON(entry)
}

func GetGoalCheckIns(c *fiber.Ctx) error {
	ctx, cancel, _, goalID, err := loadActivityGoal(c)
	if cancel != nil {
		defer cancel()
	}
	if err != nil {
		return err
	}
	user := c.Locals("user").(models.User)
	filter, err := rangeFilterForGoal(c, goalID, user.ID, "weekStart")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	cursor, err := config.DB.Collection(goalCheckInsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "weekStart", Value: 1}}))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch check-ins"})
	}
	defer cursor.Close(ctx)
	var entries []models.GoalCheckIn
	if err := cursor.All(ctx, &entries); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse check-ins"})
	}
	if entries == nil {
		entries = []models.GoalCheckIn{}
	}
	return c.JSON(entries)
}
