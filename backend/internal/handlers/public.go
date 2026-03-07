package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Notice struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title     string             `bson:"title" json:"title"`
	Content   string             `bson:"content" json:"content"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

func GetNotices(c *fiber.Ctx) error {
	collection := config.DB.Collection("notices")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch notices"})
	}
	defer cursor.Close(ctx)

	var notices []Notice
	if err = cursor.All(ctx, &notices); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse notices"})
	}

	if notices == nil {
		notices = []Notice{}
	}

	return c.JSON(notices)
}

type FAQ struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Question  string             `bson:"question" json:"question"`
	Answer    string             `bson:"answer" json:"answer"`
	ExamType  string             `bson:"examType" json:"examType"`
	Published bool               `bson:"published" json:"published"`
}

func GetFAQs(c *fiber.Ctx) error {
	examType := c.Params("examType")

	collection := config.DB.Collection("faqs")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"published": true}
	if examType != "" && examType != "all" {
		filter["examType"] = examType
	}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch FAQs"})
	}
	defer cursor.Close(ctx)

	var faqs []FAQ
	if err = cursor.All(ctx, &faqs); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse FAQs"})
	}

	if faqs == nil {
		faqs = []FAQ{}
	}

	return c.JSON(faqs)
}
