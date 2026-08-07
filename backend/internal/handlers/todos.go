package handlers

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type todoListQuery struct {
	filter bson.M
	limit  int64
	offset int64
}

func todoListLocation(requestTimezone, profileTimezone string) (*time.Location, error) {
	requestTimezone = strings.TrimSpace(requestTimezone)
	if requestTimezone != "" {
		location, err := time.LoadLocation(requestTimezone)
		if err != nil {
			return nil, fmt.Errorf("timezone must be a valid IANA timezone")
		}
		return location, nil
	}
	if location, ok := loadGoalLocation(profileTimezone); ok {
		return location, nil
	}
	return time.UTC, nil
}

func buildTodoListQuery(
	userID primitive.ObjectID,
	dateValue string,
	overdueValue string,
	completedValue string,
	limitValue string,
	offsetValue string,
	timezoneValue string,
	profileTimezone string,
	now time.Time,
) (todoListQuery, error) {
	location, err := todoListLocation(timezoneValue, profileTimezone)
	if err != nil {
		return todoListQuery{}, err
	}
	clauses := bson.A{bson.M{"userId": userID}}

	if completedValue != "" {
		completed, err := strconv.ParseBool(completedValue)
		if err != nil {
			return todoListQuery{}, fmt.Errorf("completed must be true or false")
		}
		clauses = append(clauses, bson.M{"completed": completed})
	}

	if dateValue != "" {
		dayStart, err := parseDateOnlyInLocation(dateValue, location)
		if err != nil {
			return todoListQuery{}, fmt.Errorf("date must use YYYY-MM-DD")
		}
		dayEnd := dayStart.AddDate(0, 0, 1)
		clauses = append(clauses, bson.M{"$or": bson.A{
			bson.M{"scheduledDate": bson.M{"$gte": dayStart.UTC(), "$lt": dayEnd.UTC()}},
			bson.M{"dueDate": bson.M{"$gte": dayStart.UTC(), "$lt": dayEnd.UTC()}},
		}})
	}

	if overdueValue != "" {
		overdue, err := strconv.ParseBool(overdueValue)
		if err != nil {
			return todoListQuery{}, fmt.Errorf("overdue must be true or false")
		}
		if overdue {
			today := localGoalDay(now, location).UTC()
			clauses = append(clauses,
				bson.M{"completed": false},
				bson.M{"$or": bson.A{
					bson.M{"scheduledDate": bson.M{"$lt": today}},
					bson.M{"dueDate": bson.M{"$lt": today}},
				}},
			)
		}
	}

	limit := int64(200)
	if limitValue != "" {
		parsed, err := strconv.ParseInt(limitValue, 10, 64)
		if err != nil || parsed < 1 || parsed > 500 {
			return todoListQuery{}, fmt.Errorf("limit must be between 1 and 500")
		}
		limit = parsed
	}

	offset := int64(0)
	if offsetValue != "" {
		parsed, err := strconv.ParseInt(offsetValue, 10, 64)
		if err != nil || parsed < 0 || parsed > 10000 {
			return todoListQuery{}, fmt.Errorf("offset must be between 0 and 10000")
		}
		offset = parsed
	}

	return todoListQuery{
		filter: bson.M{"$and": clauses},
		limit:  limit,
		offset: offset,
	}, nil
}

func GetTodos(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query, err := buildTodoListQuery(
		user.ID,
		c.Query("date"),
		c.Query("overdue"),
		c.Query("completed"),
		c.Query("limit"),
		c.Query("offset"),
		c.Query("timezone"),
		user.Timezone,
		time.Now(),
	)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	cursor, err := collection.Find(ctx, query.filter, options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: -1}}).
		SetSkip(query.offset).
		SetLimit(query.limit))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch todos"})
	}
	defer cursor.Close(ctx)

	var todos []models.Todo
	if err = cursor.All(ctx, &todos); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse todos"})
	}

	if todos == nil {
		todos = []models.Todo{}
	}
	return c.JSON(todos)
}

type CreateTodoRequest struct {
	Title           string     `json:"title"`
	Subject         string     `json:"subject"`
	Difficulty      string     `json:"difficulty"`
	QuestionsTarget int        `json:"questionsTarget"`
	DueDate         *time.Time `json:"dueDate"`
	ScheduledDate   *time.Time `json:"scheduledDate"`
}

func CreateTodo(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateTodoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Subject = strings.TrimSpace(req.Subject)
	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Task title is required"})
	}
	if len([]rune(req.Title)) > 300 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Task title must be 300 characters or fewer"})
	}

	todo := models.Todo{
		UserID:          user.ID,
		Title:           req.Title,
		Subject:         req.Subject,
		Difficulty:      req.Difficulty,
		QuestionsTarget: req.QuestionsTarget,
		Completed:       false,
		DueDate:         req.DueDate,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	if todo.Subject == "" {
		todo.Subject = "General"
	}
	if todo.Difficulty == "" {
		todo.Difficulty = "medium"
	}
	if todo.QuestionsTarget <= 0 {
		todo.QuestionsTarget = 10
	}
	if req.ScheduledDate != nil {
		todo.ScheduledDate = req.ScheduledDate
		todo.DueDate = req.ScheduledDate
	}
	if todo.DueDate != nil {
		todo.ScheduledDate = todo.DueDate
		todo.OriginalScheduledDate = todo.DueDate
	}

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, todo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create todo"})
	}

	todo.ID = res.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(todo)
}

func UpdateTodo(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	todoIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(todoIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req struct {
		Title           *string    `json:"title"`
		Subject         *string    `json:"subject"`
		Difficulty      *string    `json:"difficulty"`
		QuestionsTarget *int       `json:"questionsTarget"`
		Completed       *bool      `json:"completed"`
		DueDate         *time.Time `json:"dueDate"`
		ScheduledDate   *time.Time `json:"scheduledDate"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	updateFields := bson.M{"updatedAt": time.Now()}
	if req.Title != nil {
		updateFields["title"] = *req.Title
	}
	if req.Completed != nil {
		updateFields["completed"] = *req.Completed
	}
	if req.Subject != nil {
		updateFields["subject"] = *req.Subject
	}
	if req.Difficulty != nil {
		updateFields["difficulty"] = *req.Difficulty
	}
	if req.QuestionsTarget != nil {
		updateFields["questionsTarget"] = *req.QuestionsTarget
	}
	if req.DueDate != nil {
		updateFields["dueDate"] = *req.DueDate
		updateFields["scheduledDate"] = *req.DueDate
	}
	if req.ScheduledDate != nil {
		updateFields["dueDate"] = *req.ScheduledDate
		updateFields["scheduledDate"] = *req.ScheduledDate
	}

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.UpdateOne(ctx, bson.M{"_id": objID, "userId": user.ID}, bson.M{"$set": updateFields})
	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Todo not found or could not update"})
	}

	return c.JSON(fiber.Map{"message": "Updated successfully"})
}

func DeleteTodo(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	todoIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(todoIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.DeleteOne(ctx, bson.M{"_id": objID, "userId": user.ID})
	if err != nil || res.DeletedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Todo not found or could not delete"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// DeleteTodosByDay deletes every todo belonging to the authenticated user that
// is scheduled/due on a given calendar day. The day is provided via the "date"
// query parameter (RFC3339 or YYYY-MM-DD). Matching is done on dueDate within
// the [startOfDay, startOfDay+24h) window.
func DeleteTodosByDay(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	dateStr := c.Query("date")
	if dateStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "date query parameter is required"})
	}

	// Accept both full RFC3339 timestamps and plain YYYY-MM-DD dates.
	parsed, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		parsed, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format. Use RFC3339 or YYYY-MM-DD"})
		}
	}

	dayStart := getStartOfDay(parsed)
	dayEnd := dayStart.Add(24 * time.Hour)

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.DeleteMany(ctx, bson.M{
		"userId":  user.ID,
		"dueDate": bson.M{"$gte": dayStart, "$lt": dayEnd},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete tasks"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tasks deleted",
		"count":   res.DeletedCount,
	})
}

func getStartOfDay(d time.Time) time.Time {
	y, m, day := d.Date()
	return time.Date(y, m, day, 0, 0, 0, 0, d.Location())
}

type RescheduleAllRequest struct {
	TargetDate *time.Time `json:"targetDate"`
}

func RescheduleAllOverdue(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req RescheduleAllRequest
	_ = c.BodyParser(&req)

	var scheduleTo time.Time
	if req.TargetDate != nil {
		scheduleTo = getStartOfDay(*req.TargetDate)
	} else {
		scheduleTo = getStartOfDay(time.Now())
	}

	today := getStartOfDay(time.Now())
	if scheduleTo.Before(today) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot schedule tasks in the past"})
	}

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find overdue tasks
	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID, "completed": false})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch todos"})
	}
	defer cursor.Close(ctx)

	var todos []models.Todo
	if err = cursor.All(ctx, &todos); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse todos"})
	}

	var overdueIds []primitive.ObjectID
	for _, todo := range todos {
		if todo.DueDate != nil {
			scheduled := getStartOfDay(*todo.DueDate)
			if scheduled.Before(today) {
				overdueIds = append(overdueIds, todo.ID)
			}
		}
	}

	if len(overdueIds) == 0 {
		return c.JSON(fiber.Map{"message": "No overdue tasks to reschedule", "count": 0})
	}

	res, err := collection.UpdateMany(
		ctx,
		bson.M{"_id": bson.M{"$in": overdueIds}},
		bson.M{"$set": bson.M{"dueDate": scheduleTo, "scheduledDate": scheduleTo, "updatedAt": time.Now()}, "$inc": bson.M{"rescheduledCount": 1}},
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reschedule tasks"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tasks rescheduled",
		"count":   res.ModifiedCount,
	})
}

func RescheduleTodo(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	todoIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(todoIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req struct {
		NewDate time.Time `json:"newDate"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "newDate is required"})
	}

	newScheduledDate := getStartOfDay(req.NewDate)
	today := getStartOfDay(time.Now())

	if newScheduledDate.Before(today) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot schedule a task in the past"})
	}

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingTodo models.Todo
	err = collection.FindOne(ctx, bson.M{"_id": objID, "userId": user.ID}).Decode(&existingTodo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Todo not found"})
	}

	if existingTodo.Completed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot reschedule a completed task"})
	}

	updatedAt := time.Now()
	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "userId": user.ID},
		bson.M{"$set": bson.M{"dueDate": newScheduledDate, "scheduledDate": newScheduledDate, "updatedAt": updatedAt}, "$inc": bson.M{"rescheduledCount": 1}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reschedule"})
	}

	usersColl := config.DB.Collection("users")
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"totalPoints": 1}, "$set": bson.M{"lastActive": time.Now()}})

	existingTodo.DueDate = &newScheduledDate
	existingTodo.ScheduledDate = &newScheduledDate
	existingTodo.RescheduledCount++
	existingTodo.UpdatedAt = updatedAt
	return c.JSON(existingTodo)
}

func RescheduleToToday(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	todoIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(todoIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	today := getStartOfDay(time.Now())

	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingTodo models.Todo
	err = collection.FindOne(ctx, bson.M{"_id": objID, "userId": user.ID}).Decode(&existingTodo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Todo not found"})
	}

	if existingTodo.Completed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot reschedule a completed task"})
	}

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "userId": user.ID},
		bson.M{"$set": bson.M{"dueDate": today, "scheduledDate": today, "updatedAt": time.Now()}, "$inc": bson.M{"rescheduledCount": 1}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reschedule"})
	}

	usersColl := config.DB.Collection("users")
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"totalPoints": 1}, "$set": bson.M{"lastActive": time.Now()}})

	existingTodo.DueDate = &today
	return c.JSON(existingTodo)
}
