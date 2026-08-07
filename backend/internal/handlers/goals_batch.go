package handlers

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const maxBatchAllGoals = 1000

type batchShowUpRequest struct {
	GoalIDs  []string `json:"goalIds"`
	Date     string   `json:"date"`
	Status   string   `json:"status"`
	Note     string   `json:"note"`
	Timezone string   `json:"timezone"`
}

type batchShowUpResult struct {
	GoalID string         `json:"goalId"`
	Date   string         `json:"date,omitempty"`
	OK     bool           `json:"ok"`
	Entry  *models.ShowUp `json:"entry,omitempty"`
	Error  string         `json:"error,omitempty"`
}

func batchActiveGoalsFilter(userID primitive.ObjectID, requestedIDs []primitive.ObjectID) bson.M {
	filter := bson.M{"userId": userID, "status": models.GoalStatusActive, "deleteState": bson.M{"$exists": false}}
	if len(requestedIDs) > 0 {
		filter["_id"] = bson.M{"$in": requestedIDs}
	}
	return filter
}

func batchAllGoalsOverflow(goalCount int) bool { return goalCount > maxBatchAllGoals }

func effectiveShowUpDate(goal models.Goal, requested string, location *time.Location, now time.Time) (string, error) {
	day := localGoalDay(now, location)
	if strings.TrimSpace(requested) != "" {
		parsed, err := parseDateOnlyInLocation(requested, location)
		if err != nil {
			return "", fmt.Errorf("date must use YYYY-MM-DD")
		}
		day = parsed
	}
	if goal.GridMode == models.GoalGridWeekly {
		day = mondayOnOrBefore(day)
	}
	return day.Format(goalDateLayout), nil
}

func saveManualShowUp(ctx context.Context, goal models.Goal, date, status, note string) (models.ShowUp, error) {
	return putManualShowUpFenced(ctx, currentManualShowUpStore(), goal, date, status, note, goalNow().UTC())
}

func PutShowUpsBatch(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	var req batchShowUpRequest
	if c.BodyParser(&req) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	activity := goalActivityRequest{Status: req.Status, Source: models.GoalSourceManual, Note: req.Note}
	if err := validateActivityRequest(&activity); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	var location *time.Location
	if strings.TrimSpace(req.Timezone) != "" {
		var err error
		location, err = time.LoadLocation(strings.TrimSpace(req.Timezone))
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "timezone must be a valid IANA timezone"})
		}
	} else {
		location = goalRequestLocation(c, user)
	}
	if len(req.GoalIDs) > maxGoalItems {
		return c.Status(400).JSON(fiber.Map{"error": "goalIds cannot contain more than 100 items"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	requestedIDs := make([]primitive.ObjectID, 0, len(req.GoalIDs))
	seen := map[primitive.ObjectID]struct{}{}
	for _, raw := range req.GoalIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "goalIds must contain valid IDs"})
		}
		if _, duplicate := seen[id]; duplicate {
			return c.Status(400).JSON(fiber.Map{"error": "goalIds must be unique"})
		}
		seen[id] = struct{}{}
		requestedIDs = append(requestedIDs, id)
	}
	filter := batchActiveGoalsFilter(user.ID, requestedIDs)
	findOptions := options.Find()
	if len(requestedIDs) == 0 {
		// Empty goalIds means all active owned goals. Read one beyond the
		// documented global safety ceiling so legacy overflow is explicit and
		// never becomes a silently partial mutation.
		findOptions.SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(maxBatchAllGoals + 1)
	}
	cursor, err := config.DB.Collection(goalsCollection).Find(ctx, filter, findOptions)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch goals"})
	}
	var goals []models.Goal
	err = cursor.All(ctx, &goals)
	cursor.Close(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse goals"})
	}
	if len(requestedIDs) == 0 && batchAllGoalsOverflow(len(goals)) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Too many active goals for one batch; provide goalIds explicitly",
			"limit": maxBatchAllGoals,
		})
	}
	byID := make(map[primitive.ObjectID]models.Goal, len(goals))
	for _, goal := range goals {
		byID[goal.ID] = goal
	}
	ordered := requestedIDs
	if len(ordered) == 0 {
		for _, goal := range goals {
			ordered = append(ordered, goal.ID)
		}
	}
	results := make([]batchShowUpResult, 0, len(ordered))
	for _, id := range ordered {
		goal, ok := byID[id]
		if !ok {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Error: "Active goal not found"})
			continue
		}
		date, dateErr := effectiveShowUpDate(goal, req.Date, location, goalNow())
		if dateErr == nil {
			dateErr = validateActivityWrite(goal, date, location, goalNow())
		}
		if dateErr != nil {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, Error: dateErr.Error()})
			continue
		}
		entry, saveErr := saveManualShowUp(ctx, goal, date, activity.Status, activity.Note)
		if errors.Is(saveErr, errGoalDefinitionStale) {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, Error: "Goal definition changed"})
			continue
		}
		if errors.Is(saveErr, errGoalConflict) {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, Error: "Show-up changed; retry"})
			continue
		}
		if mongo.IsDuplicateKeyError(saveErr) {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, Error: "Show-up already exists"})
			continue
		}
		if saveErr != nil {
			results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, Error: "Failed to save show-up"})
			continue
		}
		results = append(results, batchShowUpResult{GoalID: id.Hex(), Date: date, OK: true, Entry: &entry})
	}
	return c.JSON(fiber.Map{"results": results})
}
