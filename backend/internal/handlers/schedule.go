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

// GenerateSchedule calls the AI to create a structured time-blocked study plan.
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

	// Build the AI prompt — concise and strict to work with smaller free models
	systemPrompt := fmt.Sprintf(`You are a study schedule planner. Output ONLY a raw JSON array, nothing else.

User: %s | Goal: %s | Date: %s
Availability: %s

Request: %s

Return a JSON array where each object has EXACTLY these fields:
[{"taskTitle":"...","subject":"...","description":"...","startTime":"HH:MM","endTime":"HH:MM","date":"%s","priority":"low|medium|high"}]

Rules: 6-10 blocks, no overlaps, include breaks, 24-hour time format, specific task titles. Output ONLY the JSON array.`,
		user.Name, user.ExamGoal, body.Date,
		availContext,
		body.Prompt,
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

// callGemini generates schedule items using whatever AI provider is configured.
// Tries OpenRouter first, then falls back to Groq (which most deployments
// already have set for the news feature). This way the schedule works as long
// as EITHER key is present.
func callGemini(prompt string) ([]models.ScheduleItem, error) {
	orKey := os.Getenv("OPENROUTER_API_KEY")
	groqKey := os.Getenv("GROQ_API_KEY")

	if orKey == "" && groqKey == "" {
		return nil, fmt.Errorf("no AI key configured — set OPENROUTER_API_KEY or GROQ_API_KEY")
	}

	var lastErr error

	// ── Try OpenRouter first ──
	if orKey != "" {
		model := os.Getenv("OPENROUTER_MODEL")
		if model == "" {
			model = "google/gemma-4-26b-a4b-it:free"
		}
		items, err := callScheduleAI(
			"https://openrouter.ai/api/v1/chat/completions",
			orKey, model, prompt, true,
		)
		if err == nil {
			return items, nil
		}
		lastErr = fmt.Errorf("OpenRouter: %w", err)
	}

	// ── Fall back to Groq ──
	if groqKey != "" {
		model := os.Getenv("GROQ_SCHEDULE_MODEL")
		if model == "" {
			model = "llama-3.3-70b-versatile"
		}
		items, err := callScheduleAI(
			"https://api.groq.com/openai/v1/chat/completions",
			groqKey, model, prompt, false,
		)
		if err == nil {
			return items, nil
		}
		if lastErr != nil {
			lastErr = fmt.Errorf("%v; Groq: %w", lastErr, err)
		} else {
			lastErr = fmt.Errorf("Groq: %w", err)
		}
	}

	return nil, lastErr
}

// callScheduleAI calls any OpenAI-compatible chat endpoint and parses schedule items.
// Retries up to 3 times on 429. `mergeSystem` merges instructions into the user
// message (required for Gemma which rejects the system role).
func callScheduleAI(endpoint, apiKey, model, userPrompt string, mergeSystem bool) ([]models.ScheduleItem, error) {
	const maxAttempts = 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		items, retryAfter, err := doScheduleRequest(endpoint, apiKey, model, userPrompt, mergeSystem)
		if err == nil {
			return items, nil
		}
		if retryAfter > 0 && attempt < maxAttempts {
			time.Sleep(retryAfter)
			continue
		}
		if attempt == maxAttempts && retryAfter > 0 {
			return nil, fmt.Errorf("rate limited after %d attempts", maxAttempts)
		}
		return nil, err
	}
	return nil, fmt.Errorf("unexpected end of retry loop")
}

// doScheduleRequest makes a single OpenAI-compatible chat completion call.
// Returns (items, retryAfter, error). retryAfter > 0 means it was a 429.
func doScheduleRequest(endpoint, apiKey, model, userPrompt string, mergeSystem bool) ([]models.ScheduleItem, time.Duration, error) {
	instruction := "You ONLY output a raw JSON array. No markdown, no code fences, no explanation before or after. Start your response with [ and end with ]."

	var messages []map[string]string
	if mergeSystem {
		// Gemma-safe: everything in one user message (Gemma rejects system role)
		messages = []map[string]string{
			{"role": "user", "content": instruction + "\n\n" + userPrompt},
		}
	} else {
		// Groq/Llama: proper system + user split
		messages = []map[string]string{
			{"role": "system", "content": instruction},
			{"role": "user", "content": userPrompt},
		}
	}

	reqBody := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": 0.3,
		"max_tokens":  4096,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, 0, err
	}

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, 0, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("HTTP-Referer", "https://sbd.satym.in")
	httpReq.Header.Set("X-Title", "StudyBuddy")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, 0, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retryDelay := 15 * time.Second
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			var secs float64
			if _, scanErr := fmt.Sscanf(ra, "%f", &secs); scanErr == nil && secs > 0 {
				retryDelay = time.Duration((secs+1)*float64(time.Second))
			}
		}
		return nil, retryDelay, fmt.Errorf("rate limited (429)")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("API error %d: %s", resp.StatusCode, string(b[:safeMin(300, len(b))]))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, 0, fmt.Errorf("bad response: %w — raw: %s", err, string(b[:safeMin(300, len(b))]))
	}
	if result.Error != nil {
		return nil, 0, fmt.Errorf("%s", result.Error.Message)
	}
	if len(result.Choices) == 0 || result.Choices[0].Message.Content == "" {
		return nil, 0, fmt.Errorf("empty response — raw: %s", string(b[:safeMin(300, len(b))]))
	}

	rawText := extractJSONArray(strings.TrimSpace(result.Choices[0].Message.Content))

	var items []models.ScheduleItem
	if err := json.Unmarshal([]byte(rawText), &items); err != nil {
		return nil, 0, fmt.Errorf("could not parse schedule JSON: %w — got: %s", err, rawText[:safeMin(400, len(rawText))])
	}
	if len(items) == 0 {
		return nil, 0, fmt.Errorf("AI returned empty schedule")
	}

	return items, 0, nil
}

// extractJSONArray robustly pulls the first complete JSON array out of a
// string that may contain markdown fences, preamble text, or extra prose.
func extractJSONArray(s string) string {
	// Strip common markdown fences first
	s = strings.TrimSpace(s)
	for _, fence := range []string{"```json", "```JSON", "```"} {
		if idx := strings.Index(s, fence); idx != -1 {
			s = s[idx+len(fence):]
			if end := strings.Index(s, "```"); end != -1 {
				s = s[:end]
			}
			s = strings.TrimSpace(s)
			break
		}
	}

	// Find the outermost [ ... ] with proper bracket balancing
	start := strings.Index(s, "[")
	if start == -1 {
		return s
	}
	depth := 0
	inString := false
	escaped := false
	for i := start; i < len(s); i++ {
		ch := s[i]
		if escaped {
			escaped = false
			continue
		}
		if ch == '\\' && inString {
			escaped = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		if ch == '[' {
			depth++
		} else if ch == ']' {
			depth--
			if depth == 0 {
				return s[start : i+1]
			}
		}
	}
	// Fallback: return from [ to last ]
	if end := strings.LastIndex(s, "]"); end > start {
		return s[start : end+1]
	}
	return s[start:]
}

func safeMin(a, b int) int {
	if a < b {
		return a
	}
	return b
}
