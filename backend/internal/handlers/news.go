package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ─────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────

type CachedNews struct {
	Data      interface{}
	Timestamp int64
}

var newsCache = sync.Map{}

// 6 hours — dramatically reduces API calls across server restarts and
// multiple users hitting the same exam type.
var CACHE_DURATION int64 = 6 * 3600 * 1000

// ─────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────

func getGroqAPIKey() string {
	return strings.TrimSpace(os.Getenv("GROQ_API_KEY"))
}

// getGroqModel returns the Groq model to use.
// compound-mini does one live web search per call so dates/news are current.
// Falls back to llama-3.1-8b-instant if GROQ_MODEL is not set.
func getGroqModel() string {
	if m := strings.TrimSpace(os.Getenv("GROQ_MODEL")); m != "" {
		return m
	}
	return "compound-beta-mini"
}

// ─────────────────────────────────────────────
// Allowed categories / valid exam types
// ─────────────────────────────────────────────

var allowedNewsCategories = map[string]struct{}{
	"announcement": {},
	"syllabus":     {},
	"notification": {},
	"tips":         {},
	"motivation":   {},
	"strategy":     {},
	"result":       {},
}

func normalizeCategory(category string) string {
	cat := strings.ToLower(strings.TrimSpace(category))
	if _, ok := allowedNewsCategories[cat]; ok {
		return cat
	}
	return "announcement"
}

func isValidExamType(examTypeUpper string) bool {
	validExams := []string{"JEE", "NEET", "GATE", "UPSC", "CAT", "NDA", "CLAT"}
	for _, exam := range validExams {
		if exam == examTypeUpper {
			return true
		}
	}
	return false
}

// ─────────────────────────────────────────────
// News item type + normaliser
// ─────────────────────────────────────────────

type generatedNewsItem struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	Category string `json:"category"`
	Date     string `json:"date"`
	Source   string `json:"source"`
}

func normalizeNewsItems(raw interface{}) ([]generatedNewsItem, error) {
	rawBytes, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}

	var items []generatedNewsItem
	if err := json.Unmarshal(rawBytes, &items); err != nil {
		return nil, err
	}

	nowDate := time.Now().Format("2006-01-02")
	normalized := make([]generatedNewsItem, 0, len(items))

	for _, item := range items {
		title := strings.TrimSpace(item.Title)
		content := strings.TrimSpace(item.Content)
		if title == "" || content == "" {
			continue
		}
		category := normalizeCategory(item.Category)
		date := strings.TrimSpace(item.Date)
		if date == "" {
			date = nowDate
		}
		source := strings.TrimSpace(item.Source)
		if source == "" {
			source = "StudyBuddy AI"
		}
		normalized = append(normalized, generatedNewsItem{
			Title:    title,
			Content:  content,
			Category: category,
			Date:     date,
			Source:   source,
		})
	}

	if len(normalized) == 0 {
		return nil, errors.New("empty or invalid news payload from AI")
	}
	return normalized, nil
}

// ─────────────────────────────────────────────
// JSON parser with fallback boundary detection
// ─────────────────────────────────────────────

func parseJSONWithFallback(responseText, startToken, endToken string, out interface{}) error {
	trimmed := strings.TrimSpace(responseText)
	if err := json.Unmarshal([]byte(trimmed), out); err == nil {
		return nil
	}
	startIdx := strings.Index(trimmed, startToken)
	endIdx := strings.LastIndex(trimmed, endToken)
	if startIdx == -1 || endIdx == -1 || endIdx <= startIdx {
		return errors.New("failed to find JSON boundaries")
	}
	return json.Unmarshal([]byte(trimmed[startIdx:endIdx+1]), out)
}

// ─────────────────────────────────────────────
// Groq API client
// ─────────────────────────────────────────────

var errGroqTooLarge = errors.New("groq: request too large")

// callGroq calls Groq's OpenAI-compatible chat completions endpoint.
// Retries up to 3 times on 429, respecting the Retry-After header.
// On 413 (request too large from compound model's search context),
// retries once with a plain fast model instead.
func callGroq(systemPrompt, userPrompt string, maxTokens int) (string, error) {
	apiKey := getGroqAPIKey()
	if apiKey == "" {
		return "", errors.New("GROQ_API_KEY not configured")
	}

	model := getGroqModel()
	const maxAttempts = 3

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		text, retryAfter, err := doGroqRequest(apiKey, model, systemPrompt, userPrompt, maxTokens)
		if err == nil {
			return text, nil
		}

		// 413: compound model accumulated too much search context — retry with plain model
		if errors.Is(err, errGroqTooLarge) {
			fallbackTokens := maxTokens / 2
			if fallbackTokens < 512 {
				fallbackTokens = 512
			}
			return doGroqRequestSimple(apiKey, "llama-3.1-8b-instant", systemPrompt, userPrompt, fallbackTokens)
		}

		// 429: wait and retry
		if retryAfter > 0 && attempt < maxAttempts {
			time.Sleep(retryAfter)
			continue
		}
		if attempt == maxAttempts && retryAfter > 0 {
			return "", fmt.Errorf("AI service busy — please try again in a minute")
		}
		return "", err
	}
	return "", errors.New("unexpected end of retry loop")
}

// doGroqRequest makes a single Groq API call.
// Returns (text, retryAfter, error). retryAfter > 0 on 429.
func doGroqRequest(apiKey, model, systemPrompt, userPrompt string, maxTokens int) (string, time.Duration, error) {
	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.5,
		"max_tokens":  maxTokens,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, err
	}

	req, err := http.NewRequest(http.MethodPost,
		"https://api.groq.com/openai/v1/chat/completions",
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retryDelay := 15 * time.Second
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			var secs float64
			if _, parseErr := fmt.Sscanf(ra, "%f", &secs); parseErr == nil && secs > 0 {
				retryDelay = time.Duration((secs+1)*float64(time.Second))
			}
		}
		return "", retryDelay, fmt.Errorf("rate limited (429)")
	}

	if resp.StatusCode == http.StatusRequestEntityTooLarge {
		return "", 0, errGroqTooLarge
	}

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("Groq API error (%d): %s", resp.StatusCode, string(respBytes))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", 0, fmt.Errorf("failed to parse Groq response: %w", err)
	}
	if len(result.Choices) == 0 || result.Choices[0].Message.Content == "" {
		return "", 0, errors.New("empty response from Groq")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), 0, nil
}

// doGroqRequestSimple is a thin wrapper for the 413-fallback path (no retry loop needed).
func doGroqRequestSimple(apiKey, model, systemPrompt, userPrompt string, maxTokens int) (string, error) {
	text, _, err := doGroqRequest(apiKey, model, systemPrompt, userPrompt, maxTokens)
	return text, err
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

func GetNews(c *fiber.Ctx) error {
	examTypeUpper := strings.ToUpper(c.Params("examType"))
	if !isValidExamType(examTypeUpper) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid exam type"})
	}

	currentTime := time.Now().UnixMilli()
	if val, ok := newsCache.Load(examTypeUpper); ok {
		cached := val.(CachedNews)
		if currentTime-cached.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cached.Data, "cached": true})
		}
	}

	if getGroqAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()

	system := "You are StudyBuddy's exam news assistant for Indian competitive exams. Use web search to find real, current information before answering. Return ONLY valid JSON without markdown, backticks, or commentary — your entire response must be the JSON array itself."

	user := fmt.Sprintf(`Today's date is %s. Search the web for the latest real news about the %s exam for Indian aspirants, for the %d exam cycle.
Generate exactly 5 useful, current, and forward-looking updates based on what you find.
Return a JSON array:
[
  {
    "title": "News headline",
    "content": "2-3 sentence summary",
    "category": "announcement|syllabus|notification|tips|motivation",
    "date": "YYYY-MM-DD",
    "source": "official or reputable source name"
  }
]
Rules:
- Every "date" MUST be %d-01-01 or later. Never output any date before %d.
- If an official date is not yet announced, give the most probable expected date and write "(expected)" in the content.
- No markdown, no backticks, no text outside the JSON array.
- Keep items relevant to %s.`,
		today, examTypeUpper, currentYear, currentYear, currentYear, examTypeUpper)

	responseText, err := callGroq(system, user, 1500)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse news response"})
	}

	normalizedNews, err := normalizeNewsItems(parsedNews)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newsCache.Store(examTypeUpper, CachedNews{Data: normalizedNews, Timestamp: currentTime})
	return c.JSON(fiber.Map{"news": normalizedNews, "cached": false})
}

func GetNewsDates(c *fiber.Ctx) error {
	examTypeUpper := strings.ToUpper(c.Params("examType"))

	if getGroqAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()

	system := "You are StudyBuddy's exam timeline assistant for Indian competitive exams. Use web search to find real, current information before answering. Return ONLY valid JSON without markdown, backticks, or commentary — your entire response must be the JSON object itself."

	user := fmt.Sprintf(`Today's date is %s. Search the web for the latest real key dates for the %s exam cycle for %d (and early %d if relevant) in India.
Return a JSON object:
{
  "examName": "%s",
  "dates": [
    {
      "event": "Event name",
      "date": "YYYY-MM-DD",
      "description": "Brief description"
    }
  ]
}
Rules:
- Every "date" MUST be %d-01-01 or later. Do not include any date before %d.
- If a date is not yet officially announced, provide the most probable expected date and note "(expected)" in the description.
- Include registration, exam, result, and counseling milestones.
- No markdown, no backticks, no extra keys, no text outside the JSON object.`,
		today, examTypeUpper, currentYear, currentYear+1, examTypeUpper, currentYear, currentYear)

	responseText, err := callGroq(system, user, 1000)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedDates interface{}
	if err := parseJSONWithFallback(responseText, "{", "}", &parsedDates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse dates response"})
	}

	return c.JSON(parsedDates)
}

type newsSearchRequest struct {
	Query string `json:"query"`
}

func SearchNews(c *fiber.Ctx) error {
	examTypeUpper := strings.ToUpper(c.Params("examType"))
	if !isValidExamType(examTypeUpper) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid exam type"})
	}

	var body newsSearchRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	query := strings.TrimSpace(body.Query)
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Please enter what you'd like to search for."})
	}
	if len(query) > 300 {
		query = query[:300]
	}

	if getGroqAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	cacheKey := "search:" + examTypeUpper + "|" + strings.ToLower(query)
	currentTime := time.Now().UnixMilli()
	if val, ok := newsCache.Load(cacheKey); ok {
		cached := val.(CachedNews)
		if currentTime-cached.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cached.Data, "cached": true, "query": query})
		}
	}

	today := time.Now().Format("2006-01-02")

	system := "You are StudyBuddy's exam news assistant for Indian competitive exams. Use web search to find real, accurate information before answering. Return ONLY valid JSON without markdown, backticks, or commentary — your entire response must be the JSON array itself."

	user := fmt.Sprintf(`Today's date is %s. A %s aspirant in India asked: "%s"
Search the web and respond with 3 to 6 news/update items that best answer this query.
- For past exam cycles, give accurate information for that period with real dates from that timeframe.
- For current/upcoming cycle, give current or most-probable expected updates and write "(expected)" for unconfirmed dates.
- Omit items you cannot find real information for rather than inventing them.

Return a JSON array:
[
  {
    "title": "Headline",
    "content": "2-3 sentence summary",
    "category": "announcement|syllabus|notification|tips|motivation|strategy|result",
    "date": "YYYY-MM-DD",
    "source": "official or reputable source name"
  }
]
Rules:
- No markdown, no backticks, no extra keys, no text outside the JSON array.
- Date must be YYYY-MM-DD and match the timeframe implied by the query.
- Keep every item relevant to %s and the user's query.`,
		today, examTypeUpper, query, examTypeUpper)

	responseText, err := callGroq(system, user, 1800)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse search response"})
	}

	normalizedNews, err := normalizeNewsItems(parsedNews)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newsCache.Store(cacheKey, CachedNews{Data: normalizedNews, Timestamp: currentTime})
	return c.JSON(fiber.Map{"news": normalizedNews, "cached": false, "query": query})
}

func ClearNewsCache(c *fiber.Ctx) error {
	newsCache.Range(func(key interface{}, _ interface{}) bool {
		newsCache.Delete(key)
		return true
	})
	return c.JSON(fiber.Map{"success": true, "message": "News cache cleared"})
}
