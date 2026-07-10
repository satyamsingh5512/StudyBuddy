package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ─────────────────────────────────────────────
// Availability CRUD
// ─────────────────────────────────────────────

// GetAvailability returns the authenticated user's availability config.
func GetAvailability(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	col := config.DB.Collection("availabilities")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var avail models.Availability
	err := col.FindOne(ctx, bson.M{"userId": user.ID}).Decode(&avail)
	if err != nil {
		// Return empty structure if none set yet
		return c.JSON(fiber.Map{
			"id":           nil,
			"freeBlocks":   []interface{}{},
			"blockedSlots": []interface{}{},
			"wakeTime":     "",
			"sleepTime":    "",
		})
	}
	return c.JSON(avail)
}

// UpsertAvailability creates or replaces the user's availability config.
func UpsertAvailability(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var body struct {
		FreeBlocks   []models.TimeBlock `json:"freeBlocks"`
		BlockedSlots []models.TimeBlock `json:"blockedSlots"`
		WakeTime     string             `json:"wakeTime"`
		SleepTime    string             `json:"sleepTime"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	col := config.DB.Collection("availabilities")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"userId": user.ID}
	update := bson.M{
		"$set": bson.M{
			"userId":       user.ID,
			"freeBlocks":   body.FreeBlocks,
			"blockedSlots": body.BlockedSlots,
			"wakeTime":     body.WakeTime,
			"sleepTime":    body.SleepTime,
			"updatedAt":    time.Now(),
		},
		"$setOnInsert": bson.M{
			"_id": primitive.NewObjectID(),
		},
	}
	opts := options.Update().SetUpsert(true)
	if _, err := col.UpdateOne(ctx, filter, update, opts); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save availability"})
	}

	var result models.Availability
	_ = col.FindOne(ctx, filter).Decode(&result)
	return c.JSON(result)
}

// ─────────────────────────────────────────────
// Schedule CRUD
// ─────────────────────────────────────────────

// GetSchedules returns all schedules for the user (optionally filtered by date).
func GetSchedules(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	col := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"userId": user.ID}
	if date := c.Query("date"); date != "" {
		filter["date"] = date
	}

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(30)
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch schedules"})
	}
	defer cursor.Close(ctx)

	var schedules []models.Schedule
	if err = cursor.All(ctx, &schedules); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse schedules"})
	}
	if schedules == nil {
		schedules = []models.Schedule{}
	}
	return c.JSON(schedules)
}

// DeleteSchedule deletes a specific schedule.
func DeleteSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid schedule ID"})
	}

	col := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := col.DeleteOne(ctx, bson.M{"_id": id, "userId": user.ID})
	if err != nil || result.DeletedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Schedule not found"})
	}
	return c.JSON(fiber.Map{"success": true})
}

// UpdateScheduleItem updates a single item inside a schedule (e.g. mark complete).
func UpdateScheduleItem(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	scheduleID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid schedule ID"})
	}
	itemID, err := primitive.ObjectIDFromHex(c.Params("itemId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid item ID"})
	}

	var body struct {
		Completed bool `json:"completed"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	col := config.DB.Collection("schedules")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Calculate points to award when completing a scheduled task
	pointsToAdd := 0
	if body.Completed {
		pointsToAdd = 15 // base points per scheduled task completed
	}

	updateFields := bson.M{
		"items.$[item].completed": body.Completed,
		"updatedAt":               time.Now(),
	}
	if body.Completed {
		updateFields["items.$[item].pointsAwarded"] = pointsToAdd
	}

	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{bson.M{"item._id": itemID}},
	})
	_, err = col.UpdateOne(
		ctx,
		bson.M{"_id": scheduleID, "userId": user.ID},
		bson.M{"$set": updateFields},
		arrayFilters,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update item"})
	}

	// Award points to user if completing
	if body.Completed && pointsToAdd > 0 {
		usersCol := config.DB.Collection("users")
		_, _ = usersCol.UpdateOne(
			ctx,
			bson.M{"_id": user.ID},
			bson.M{"$inc": bson.M{"totalPoints": pointsToAdd}},
		)
	}

	return c.JSON(fiber.Map{"success": true, "pointsAwarded": pointsToAdd})
}

// ─────────────────────────────────────────────
// Gemini AI Schedule Generation
// ─────────────────────────────────────────────

// geminiRequest is the request body for Gemini REST API.
type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// GenerateSchedule calls Gemini to create a structured time-blocked study plan.
func GenerateSchedule(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)

	var body struct {
		Prompt string `json:"prompt"`
		Date   string `json:"date"` // "2026-07-10"
	}
	if err := c.BodyParser(&body); err != nil || body.Prompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Prompt is required"})
	}
	if body.Date == "" {
		body.Date = time.Now().Format("2006-01-02")
	}

	// Fetch availability context
	availCol := config.DB.Collection("availabilities")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var avail models.Availability
	_ = availCol.FindOne(ctx, bson.M{"userId": user.ID}).Decode(&avail)

	availContext := buildAvailabilityContext(avail)

	// Build the Gemini prompt
	systemPrompt := fmt.Sprintf(`You are an expert study schedule planner for competitive exam students.

USER CONTEXT:
- Name: %s
- Exam Goal: %s
- Availability: %s

USER REQUEST:
%s

Today's date: %s

Create a detailed, time-blocked study schedule in VALID JSON format. Return ONLY a JSON array with no markdown, no explanation, just the raw JSON array.

Each item must have exactly these fields:
{
  "taskTitle": "string (specific task name)",
  "subject": "string (subject area)",
  "description": "string (what to do in this session)",
  "startTime": "HH:MM (24-hour format)",
  "endTime": "HH:MM (24-hour format)",
  "date": "%s",
  "priority": "low|medium|high"
}

Rules:
- Respect the user's available time windows
- Include short breaks (label them as "Break" subject)
- Be specific about topics (e.g. "Solve 30 DSA problems on Binary Trees" not just "DSA")
- Schedule at least 6-10 blocks
- Higher priority for weaker subjects or upcoming deadlines
- Don't overlap time blocks
- Return ONLY the JSON array, nothing else`,
		user.Name,
		user.ExamGoal,
		availContext,
		body.Prompt,
		body.Date,
		body.Date,
	)

	// Call Gemini
	scheduleItems, err := callGemini(systemPrompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	// Assign ObjectIDs to each item
	for i := range scheduleItems {
		scheduleItems[i].ID = primitive.NewObjectID()
		scheduleItems[i].Date = body.Date
	}

	// Save to DB
	schedule := models.Schedule{
		ID:          primitive.NewObjectID(),
		UserID:      user.ID,
		GeneratedAt: time.Now(),
		Prompt:      body.Prompt,
		Items:       scheduleItems,
		Date:        body.Date,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	col := config.DB.Collection("schedules")
	if _, err := col.InsertOne(ctx, schedule); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save schedule"})
	}

	return c.JSON(schedule)
}

// buildAvailabilityContext converts availability model to a human-readable string for the prompt.
func buildAvailabilityContext(avail models.Availability) string {
	if len(avail.FreeBlocks) == 0 && avail.WakeTime == "" {
		return "No specific availability configured. Assume standard 8AM-10PM schedule."
	}
	result := ""
	if avail.WakeTime != "" {
		result += fmt.Sprintf("Wake at %s, Sleep at %s. ", avail.WakeTime, avail.SleepTime)
	}
	days := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	if len(avail.FreeBlocks) > 0 {
		result += "Available windows: "
		for _, b := range avail.FreeBlocks {
			d := "Day"
			if b.DayOfWeek >= 0 && b.DayOfWeek <= 6 {
				d = days[b.DayOfWeek]
			}
			result += fmt.Sprintf("%s %s-%s, ", d, b.StartTime, b.EndTime)
		}
	}
	if len(avail.BlockedSlots) > 0 {
		result += "Blocked/busy: "
		for _, b := range avail.BlockedSlots {
			d := "Day"
			if b.DayOfWeek >= 0 && b.DayOfWeek <= 6 {
				d = days[b.DayOfWeek]
			}
			lbl := b.Label
			if lbl == "" {
				lbl = "busy"
			}
			result += fmt.Sprintf("%s %s-%s (%s), ", d, b.StartTime, b.EndTime, lbl)
		}
	}
	return result
}

// callGemini calls the Gemini REST API and parses the schedule items out of the response.
// Retries up to 3 times on 429 rate-limit errors, respecting the API's retry-delay.
func callGemini(prompt string) ([]models.ScheduleItem, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not configured")
	}

	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.5-flash"
	}

	const maxAttempts = 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		items, retryAfter, err := doGeminiScheduleRequest(apiKey, geminiModel, prompt)
		if err == nil {
			return items, nil
		}
		if retryAfter > 0 && attempt < maxAttempts {
			time.Sleep(retryAfter)
			continue
		}
		if attempt == maxAttempts && retryAfter > 0 {
			return nil, fmt.Errorf("Gemini rate limit exceeded after %d attempts. Please try again in a minute", maxAttempts)
		}
		return nil, err
	}
	return nil, fmt.Errorf("unexpected end of retry loop")
}

// doGeminiScheduleRequest makes a single Gemini generateContent call for schedule generation.
// Returns (items, retryAfter, error). retryAfter > 0 means it was a 429.
func doGeminiScheduleRequest(apiKey, geminiModel, prompt string) ([]models.ScheduleItem, time.Duration, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		geminiModel, apiKey,
	)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, 0, err
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, 0, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retryDelay := parseScheduleRetryDelay(b)
		return nil, retryDelay, fmt.Errorf("rate limited (429)")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("Gemini API error %d: %s", resp.StatusCode, string(b))
	}

	var gemResp geminiResponse
	if err := json.Unmarshal(b, &gemResp); err != nil {
		return nil, 0, err
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return nil, 0, fmt.Errorf("empty response from Gemini")
	}

	rawText := gemResp.Candidates[0].Content.Parts[0].Text
	rawText = stripMarkdownJSON(rawText)

	var items []models.ScheduleItem
	if err := json.Unmarshal([]byte(rawText), &items); err != nil {
		return nil, 0, fmt.Errorf("failed to parse Gemini JSON output: %w\n\nRaw: %s", err, rawText[:safeMin(200, len(rawText))])
	}

	return items, 0, nil
}

// parseScheduleRetryDelay extracts the retryDelay from a Gemini 429 response body.
func parseScheduleRetryDelay(body []byte) time.Duration {
	var errResp struct {
		Error struct {
			Details []struct {
				Type       string `json:"@type"`
				RetryDelay string `json:"retryDelay"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &errResp); err == nil {
		for _, d := range errResp.Error.Details {
			if strings.Contains(d.Type, "RetryInfo") && d.RetryDelay != "" {
				s := strings.TrimSuffix(d.RetryDelay, "s")
				var secs float64
				if _, err := fmt.Sscanf(s, "%f", &secs); err == nil && secs > 0 {
					return time.Duration((secs+2)*float64(time.Second))
				}
			}
		}
	}
	return 15 * time.Second
}

// stripMarkdownJSON removes ```json ... ``` fences from Gemini output.
func stripMarkdownJSON(s string) string {
	// Try to find array boundaries robustly
	start := -1
	end := -1
	for i, ch := range s {
		if ch == '[' && start == -1 {
			start = i
		}
		if ch == ']' {
			end = i
		}
	}
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func safeMin(a, b int) int {
	if a < b {
		return a
	}
	return b
}
