package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetNotes returns all notes for the authenticated user.
// Optional query params:
//   - q:     case-insensitive search across title, content and tags
//   - color: filter by highlight color
// Results are sorted with pinned notes first, then most recently updated.
func GetNotes(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	collection := config.DB.Collection("notes")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"userId": user.ID}

	if q := c.Query("q"); q != "" {
		// Escape regex special characters so user input is treated literally.
		safe := regexpEscape(q)
		regex := bson.M{"$regex": safe, "$options": "i"}
		filter["$or"] = bson.A{
			bson.M{"title": regex},
			bson.M{"content": regex},
			bson.M{"tags": regex},
		}
	}

	if color := c.Query("color"); color != "" {
		filter["color"] = color
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "pinned", Value: -1},
		{Key: "updatedAt", Value: -1},
	})

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch notes"})
	}
	defer cursor.Close(ctx)

	var notes []models.Note
	if err = cursor.All(ctx, &notes); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse notes"})
	}

	if notes == nil {
		notes = []models.Note{}
	}
	return c.JSON(notes)
}

type CreateNoteRequest struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Color   string   `json:"color"`
	Tags    []string `json:"tags"`
	Pinned  bool     `json:"pinned"`
}

func CreateNote(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Content == "" && req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Note cannot be empty"})
	}

	note := models.Note{
		UserID:    user.ID,
		Title:     req.Title,
		Content:   req.Content,
		Color:     req.Color,
		Tags:      req.Tags,
		Pinned:    req.Pinned,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if note.Tags == nil {
		note.Tags = []string{}
	}

	collection := config.DB.Collection("notes")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, note)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create note"})
	}

	note.ID = res.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(note)
}

func UpdateNote(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	noteIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(noteIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req struct {
		Title   *string   `json:"title"`
		Content *string   `json:"content"`
		Color   *string   `json:"color"`
		Tags    *[]string `json:"tags"`
		Pinned  *bool     `json:"pinned"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	updateFields := bson.M{"updatedAt": time.Now()}
	if req.Title != nil {
		updateFields["title"] = *req.Title
	}
	if req.Content != nil {
		updateFields["content"] = *req.Content
	}
	if req.Color != nil {
		updateFields["color"] = *req.Color
	}
	if req.Tags != nil {
		updateFields["tags"] = *req.Tags
	}
	if req.Pinned != nil {
		updateFields["pinned"] = *req.Pinned
	}

	collection := config.DB.Collection("notes")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.UpdateOne(ctx, bson.M{"_id": objID, "userId": user.ID}, bson.M{"$set": updateFields})
	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Note not found or could not update"})
	}

	return c.JSON(fiber.Map{"message": "Updated successfully"})
}

func DeleteNote(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	noteIDHex := c.Params("id")

	objID, err := primitive.ObjectIDFromHex(noteIDHex)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	collection := config.DB.Collection("notes")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.DeleteOne(ctx, bson.M{"_id": objID, "userId": user.ID})
	if err != nil || res.DeletedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Note not found or could not delete"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// regexpEscape escapes characters that carry special meaning in a regular
// expression so that user-supplied search terms are matched literally.
func regexpEscape(s string) string {
	const special = `\.+*?()|[]{}^$`
	out := make([]byte, 0, len(s)*2)
	for i := 0; i < len(s); i++ {
		ch := s[i]
		for j := 0; j < len(special); j++ {
			if ch == special[j] {
				out = append(out, '\\')
				break
			}
		}
		out = append(out, ch)
	}
	return string(out)
}
