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

// CACHE_DURATION: 6 hours. Keeps API calls low on the free tier — news doesn't
// change minute-to-minute, so long caching is safe and dramatically reduces
// 429 rate-limit errors when the server restarts or multiple users hit at once.
var CACHE_DURATION int64 = 6 * 3600 * 1000 // 6 hours in ms

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
		return nil, errors.New("empty or invalid news payload from Gemini")
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
// Gemini REST API — generateContent with Google Search grounding
// ─────────────────────────────────────────────

// geminiNewsRequest is the full request payload for Gemini generateContent.
type geminiNewsRequest struct {
	Contents []geminiNewsContent `json:"contents"`
	Tools    []geminiNewsTool    `json:"tools"`
}

type geminiNewsContent struct {
	Parts []geminiNewsPart `json:"parts"`
}

type geminiNewsPart struct {
	Text string `json:"text"`
}

// geminiNewsTool enables the Google Search grounding tool so Gemini can
// fetch live web results before generating its answer — keeping news and
// exam dates factually current with a real web search on every uncached call.
type geminiNewsTool struct {
	GoogleSearch map[string]interface{} `json:"google_search"`
}

type geminiNewsResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func getGeminiAPIKey() string {
	return strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
}

// getGeminiModel returns the model ID from GEMINI_MODEL env var,
// defaulting to gemini-2.5-flash (current stable model with free tier).
func getGeminiModel() string {
	if m := strings.TrimSpace(os.Getenv("GEMINI_MODEL")); m != "" {
		return m
	}
	return "gemini-2.5-flash"
}

// callGeminiNews calls Gemini with Google Search grounding enabled
// and returns the raw text response. Retries once on 429 after the
// retry-delay the API specifies (or 15s if not present).
func callGeminiNews(prompt string) (string, error) {
	apiKey := getGeminiAPIKey()
	if apiKey == "" {
		return "", errors.New("GEMINI_API_KEY not configured")
	}

	const maxAttempts = 3
	retryDelay := 15 * time.Second

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		text, waitFor, err := doGeminiRequest(apiKey, prompt)
		if err == nil {
			return text, nil
		}
		// If it's a 429 and we have attempts left, wait and retry
		if waitFor > 0 && attempt < maxAttempts {
			time.Sleep(waitFor)
			continue
		}
		// For any other error or if we're out of retries, return the error
		if attempt == maxAttempts && waitFor > 0 {
			return "", fmt.Errorf("Gemini rate limit exceeded after %d attempts. Please try again in a minute", maxAttempts)
		}
		return "", err
	}
	_ = retryDelay // silence unused warning
	return "", errors.New("unexpected end of retry loop")
}

// doGeminiRequest makes a single HTTP call to Gemini generateContent.
// Returns (text, retryAfter, error). retryAfter > 0 means it was a 429.
func doGeminiRequest(apiKey, prompt string) (string, time.Duration, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		getGeminiModel(), apiKey,
	)

	reqBody := geminiNewsRequest{
		Contents: []geminiNewsContent{
			{Parts: []geminiNewsPart{{Text: prompt}}},
		},
		// Google Search grounding: Gemini searches the live web before
		// answering, giving real current exam dates and news.
		Tools: []geminiNewsTool{
			{GoogleSearch: map[string]interface{}{}},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, err
	}

	// Handle 429 — parse retry delay from response if available
	if resp.StatusCode == http.StatusTooManyRequests {
		retryDelay := parseRetryDelay(respBytes)
		return "", retryDelay, fmt.Errorf("rate limited (429)")
	}

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("Gemini API error (%d): %s", resp.StatusCode, string(respBytes))
	}

	var gemResp geminiNewsResponse
	if err := json.Unmarshal(respBytes, &gemResp); err != nil {
		return "", 0, fmt.Errorf("failed to decode Gemini response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", 0, errors.New("empty response from Gemini")
	}

	text := strings.TrimSpace(gemResp.Candidates[0].Content.Parts[0].Text)
	if text == "" {
		return "", 0, errors.New("empty text from Gemini")
	}

	return text, 0, nil
}

// parseRetryDelay extracts the retryDelay seconds from a Gemini 429 response body.
// Falls back to 15s if not found.
func parseRetryDelay(body []byte) time.Duration {
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
				// retryDelay is like "11s" or "11.100578426s"
				s := strings.TrimSuffix(d.RetryDelay, "s")
				var secs float64
				if _, err := fmt.Sscanf(s, "%f", &secs); err == nil && secs > 0 {
					// Add 2s buffer on top of what the API asks for
					return time.Duration((secs+2)*float64(time.Second))
				}
			}
		}
	}
	return 15 * time.Second // safe default
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
		cachedEntry := val.(CachedNews)
		if currentTime-cachedEntry.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cachedEntry.Data, "cached": true})
		}
	}

	if getGeminiAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GEMINI_API_KEY."})
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()

	prompt := fmt.Sprintf(`Today's date is %s. Search the web for the latest real news about the %s exam for Indian aspirants, for the %d exam cycle.
Generate exactly 5 useful, current, and forward-looking updates based on what you find.
Return ONLY a valid JSON array — no markdown, no backticks, no commentary outside the JSON.

Schema:
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
- Every "date" MUST be %d-01-01 or later. Never output any date before %d — if you cannot find a real current source, omit that item rather than inventing an old date.
- Focus on the current and upcoming exam cycle. If an official date is not yet announced, give the most probable expected date and write "(expected)" in the content.
- No markdown, no backticks, no extra keys, no text outside the JSON array.
- Keep each item relevant to %s.`,
		today, examTypeUpper, currentYear, currentYear, currentYear, examTypeUpper)

	responseText, err := callGeminiNews(prompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Gemini news response"})
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

	if getGeminiAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GEMINI_API_KEY."})
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()

	prompt := fmt.Sprintf(`Today's date is %s. Search the web for the latest real key dates for the %s exam cycle for %d (and early %d if relevant) in India.
Return ONLY a valid JSON object — no markdown, no backticks, no text outside the JSON.

Schema:
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
- Every "date" MUST be %d-01-01 or later. Do not include any date before %d — if you cannot find a real current source, omit that item.
- If a date is not yet officially announced, provide the most probable expected date based on previous years' patterns and note "(expected)" in the description.
- Include registration, exam, result, and counseling milestones when applicable.
- No markdown, no backticks, no extra keys, no text outside the JSON object.`,
		today, examTypeUpper, currentYear, currentYear+1, examTypeUpper, currentYear, currentYear)

	responseText, err := callGeminiNews(prompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedDates interface{}
	if err := parseJSONWithFallback(responseText, "{", "}", &parsedDates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Gemini dates response"})
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

	if getGeminiAPIKey() == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GEMINI_API_KEY."})
	}

	cacheKey := "search:" + examTypeUpper + "|" + strings.ToLower(query)
	currentTime := time.Now().UnixMilli()
	if val, ok := newsCache.Load(cacheKey); ok {
		cachedEntry := val.(CachedNews)
		if currentTime-cachedEntry.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cachedEntry.Data, "cached": true, "query": query})
		}
	}

	today := time.Now().Format("2006-01-02")

	prompt := fmt.Sprintf(`Today's date is %s. A %s aspirant in India asked: "%s".
Search the web and respond with 3 to 6 news/update items that best answer this query.
- If the query is about a past exam cycle or historical data, give accurate information for that period using real dates from that timeframe.
- If the query is about the current or upcoming cycle, give current or most-probable expected updates and write "(expected)" in the content for unconfirmed dates.
- If you cannot find real information for an item, omit it rather than inventing one.

Return ONLY a valid JSON array — no markdown, no backticks, no text outside the JSON.

Schema:
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
- Keep every item relevant to %s and to the user's query.`,
		today, examTypeUpper, query, examTypeUpper)

	responseText, err := callGeminiNews(prompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Gemini search response"})
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
