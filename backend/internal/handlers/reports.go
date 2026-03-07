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

type Report struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"userId" json:"-"`
	Date          time.Time          `bson:"date" json:"date"`
	StudyHours    float64            `bson:"studyHours" json:"studyHours"`
	HoursLogged   float64            `bson:"hoursLogged" json:"hoursLogged"`
	PointsEarned  int                `bson:"pointsEarned" json:"pointsEarned"`
	CompletionPct float64            `bson:"completionPct" json:"completionPct"`
	Notes         string             `bson:"notes" json:"notes"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func GetReports(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	collection := config.DB.Collection("daily_reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(30)
	cursor, err := collection.Find(ctx, bson.M{"userId": user.ID}, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch reports"})
	}
	defer cursor.Close(ctx)

	var reports []Report
	if err = cursor.All(ctx, &reports); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse reports"})
	}

	if reports == nil {
		reports = []Report{}
	}

	return c.JSON(reports)
}

type CreateReportRequest struct {
	Date          string  `json:"date"`
	StudyHours    float64 `json:"studyHours"`
	HoursLogged   float64 `json:"hoursLogged"`
	PointsEarned  int     `json:"pointsEarned"`
	CompletionPct float64 `json:"completionPct"`
	Notes         string  `json:"notes"`
}

func CreateReport(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var req CreateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	reportDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		// Fallback to simple date parsing if RFC3339 fails (since JS Date string might differ based on frontend)
		reportDate, _ = time.Parse("2006-01-02", req.Date) 
	}

	newReport := Report{
		UserID:        user.ID,
		Date:          reportDate,
		StudyHours:    req.StudyHours,
		HoursLogged:   req.HoursLogged,
		PointsEarned:  req.PointsEarned,
		CompletionPct: req.CompletionPct,
		Notes:         req.Notes,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	collection := config.DB.Collection("daily_reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := collection.InsertOne(ctx, newReport)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create report"})
	}

	newReport.ID = res.InsertedID.(primitive.ObjectID)

	return c.Status(fiber.StatusCreated).JSON(newReport)
}
