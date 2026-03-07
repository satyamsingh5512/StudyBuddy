package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GetTodos(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("todos")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID})
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
	Title   string     `json:"title"`
	DueDate *time.Time `json:"dueDate"`
}

func CreateTodo(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateTodoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	todo := models.Todo{
		UserID:    user.ID,
		Title:     req.Title,
		Completed: false,
		DueDate:   req.DueDate,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
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
		Title     *string    `json:"title"`
		Completed *bool      `json:"completed"`
		DueDate   *time.Time `json:"dueDate"`
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
	if req.DueDate != nil {
		updateFields["dueDate"] = *req.DueDate
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
		bson.M{"$set": bson.M{"dueDate": scheduleTo, "updatedAt": time.Now()}},
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

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": objID, "userId": user.ID},
		bson.M{"$set": bson.M{"dueDate": newScheduledDate, "updatedAt": time.Now()}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reschedule"})
	}

	usersColl := config.DB.Collection("users")
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"totalPoints": 1}, "$set": bson.M{"lastActive": time.Now()}})

	existingTodo.DueDate = &newScheduledDate
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
		bson.M{"$set": bson.M{"dueDate": today, "updatedAt": time.Now()}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reschedule"})
	}

	usersColl := config.DB.Collection("users")
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"totalPoints": 1}, "$set": bson.M{"lastActive": time.Now()}})

	existingTodo.DueDate = &today
	return c.JSON(existingTodo)
}
