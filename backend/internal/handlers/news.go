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

type CachedNews struct {
	Data      interface{}
	Timestamp int64
}

var newsCache = sync.Map{}
var CACHE_DURATION int64 = 3600000 // 1 hour in ms

// defaultGroqModel uses Groq's Compound system, which augments the underlying
// Llama/GPT-OSS models with real-time web search. Plain instruction-following
// models have a training cutoff and cannot know "today's date" or current
// exam-cycle news, so they will confidently invent stale/incorrect dates no
// matter how the prompt is worded. Compound actually searches the live web
// before answering, which is required for this to be factually current.
const defaultGroqModel = "groq/compound"

var allowedNewsCategories = map[string]struct{}{
	"announcement": {},
	"syllabus":     {},
	"notification": {},
	"tips":         {},
	"motivation":   {},
	"strategy":     {},
	"result":       {},
}

type generatedNewsItem struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	Category string `json:"category"`
	Date     string `json:"date"`
	Source   string `json:"source"`
}

func getGroqModel() string {
	model := strings.TrimSpace(os.Getenv("GROQ_MODEL"))
	if model == "" {
		return defaultGroqModel
	}
	return model
}

func getGroqAPIKey() string {
	return strings.TrimSpace(os.Getenv("GROQ_API_KEY"))
}

func normalizeCategory(category string) string {
	cat := strings.ToLower(strings.TrimSpace(category))
	if _, ok := allowedNewsCategories[cat]; ok {
		return cat
	}
	return "announcement"
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
		return nil, errors.New("empty or invalid news payload from Groq")
	}

	return normalized, nil
}

// callGroqJSON sends a chat-completion request to Groq's OpenAI-compatible API
// and returns the assistant message content (expected to be JSON). Groq hosts
// open models such as Meta's Llama; the model is configurable via GROQ_MODEL.
func callGroqJSON(apiKey, model, systemInstruction, userPrompt string, temperature float64, maxOutputTokens int) (string, error) {
	requestBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemInstruction},
			{"role": "user", "content": userPrompt},
		},
		"temperature": temperature,
		"max_tokens":  maxOutputTokens,
	}

	reqBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Groq API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	var groqRes struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(bodyBytes, &groqRes); err != nil {
		return "", err
	}

	if len(groqRes.Choices) == 0 {
		return "", errors.New("no choices from Groq")
	}

	text := strings.TrimSpace(groqRes.Choices[0].Message.Content)
	if text == "" {
		return "", errors.New("empty text response from Groq")
	}

	return text, nil
}

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

func isValidExamType(examTypeUpper string) bool {
	validExams := []string{"JEE", "NEET", "GATE", "UPSC", "CAT", "NDA", "CLAT"}
	for _, exam := range validExams {
		if exam == examTypeUpper {
			return true
		}
	}
	return false
}

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

	apiKey := getGroqAPIKey()
	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	systemInstruction := "You are StudyBuddy's exam news assistant for Indian competitive exams. Use web search to find real, current information before answering. Return only valid JSON without markdown, backticks, or commentary — your entire response must be the JSON array itself."
	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()
	prompt := fmt.Sprintf(`Today's date is %s. Search the web for the latest real news about the %s exam for Indian aspirants, for the %d exam cycle.
Generate exactly 5 useful, current, and forward-looking updates based on what you find.
Return a JSON array with this schema:
[
  {
    "title": "News headline",
    "content": "2-3 sentence summary",
		"category": "announcement|syllabus|notification|tips|motivation",
    "date": "YYYY-MM-DD",
    "source": "official or reputable source"
  }
]
Rules:
- Every "date" MUST be %d-01-01 or later. Never output any date before %d — if you cannot find a real, current source, omit that item rather than inventing an old date.
- Focus on the current and upcoming exam cycle. If an official date is not yet announced, give the most probable expected date and write "(expected)" in the content.
- No markdown, no backticks, no extra keys, no text outside the JSON array.
- Date must be YYYY-MM-DD.
- Keep each item relevant to %s.`, today, examTypeUpper, currentYear, currentYear, currentYear, examTypeUpper)

	responseText, err := callGroqJSON(apiKey, getGroqModel(), systemInstruction, prompt, 0.6, 1500)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Groq news response"})
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
	apiKey := getGroqAPIKey()

	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	systemInstruction := "You are StudyBuddy's exam timeline assistant for Indian competitive exams. Use web search to find real, current information before answering. Return only valid JSON without markdown, backticks, or commentary — your entire response must be the JSON object itself."
	now := time.Now()
	today := now.Format("2006-01-02")
	currentYear := now.Year()
	prompt := fmt.Sprintf(`Today's date is %s. Search the web for the latest real key dates for the %s exam cycle for %d (and early %d if relevant) in India.
Return a JSON object with this schema:
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
- Every "date" MUST be %d-01-01 or later. Do not include any date before %d — if you cannot find a real, current source, omit that item rather than inventing an old date.
- If a date is not yet officially announced, provide the most probable expected date based on previous years' patterns and note "(expected)" in the description.
- Include registration, exam, result, and counseling milestones when applicable.
- No markdown, no backticks, no extra keys, no text outside the JSON object.
- Date must be YYYY-MM-DD.`, today, examTypeUpper, currentYear, currentYear+1, examTypeUpper, currentYear, currentYear)

	responseText, err := callGroqJSON(apiKey, getGroqModel(), systemInstruction, prompt, 0.4, 1000)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedDates interface{}
	if err := parseJSONWithFallback(responseText, "{", "}", &parsedDates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Groq dates response"})
	}

	return c.JSON(parsedDates)
}

type newsSearchRequest struct {
	Query string `json:"query"`
}

// SearchNews answers a free-form user query (e.g. "JEE 2022 cutoff trends" or
// "NEET 2026 expected exam date") with a set of relevant news items. Historical
// queries return the model's best known information; current/upcoming queries
// return current or probable expected updates. Results are cached per query.
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

	apiKey := getGroqAPIKey()
	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GROQ_API_KEY."})
	}

	cacheKey := "search:" + examTypeUpper + "|" + strings.ToLower(query)
	currentTime := time.Now().UnixMilli()
	if val, ok := newsCache.Load(cacheKey); ok {
		cachedEntry := val.(CachedNews)
		if currentTime-cachedEntry.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cachedEntry.Data, "cached": true, "query": query})
		}
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	systemInstruction := "You are StudyBuddy's exam news assistant for Indian competitive exams. Use web search to find real, accurate information before answering. Return only valid JSON without markdown, backticks, or commentary — your entire response must be the JSON array itself."
	prompt := fmt.Sprintf(`Today's date is %s. A %s aspirant in India asked: "%s".
Search the web and respond with 3 to 6 news/update items that best answer this query, based on what you find.
- If the query is about a past exam cycle or historical data, give accurate information for that period, using real dates from that timeframe.
- If the query is about the current or upcoming cycle, give current or most-probable expected updates and write "(expected)" in the content for unconfirmed dates.
- If you cannot find real information for an item, omit it rather than inventing one.

Return a JSON array with this schema:
[
  {
    "title": "Headline",
    "content": "2-3 sentence summary",
    "category": "announcement|syllabus|notification|tips|motivation|strategy|result",
    "date": "YYYY-MM-DD",
    "source": "official or reputable source"
  }
]
Rules:
- No markdown, no backticks, no extra keys.
- Date must be YYYY-MM-DD and match the timeframe implied by the query.
- Keep every item relevant to %s and to the user's query.`, today, examTypeUpper, query, examTypeUpper)

	responseText, err := callGroqJSON(apiKey, getGroqModel(), systemInstruction, prompt, 0.5, 1800)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedNews interface{}
	if err := parseJSONWithFallback(responseText, "[", "]", &parsedNews); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Groq search response"})
	}

	normalizedNews, err := normalizeNewsItems(parsedNews)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newsCache.Store(cacheKey, CachedNews{Data: normalizedNews, Timestamp: currentTime})
	return c.JSON(fiber.Map{"news": normalizedNews, "cached": false, "query": query})
}

func ClearNewsCache(c *fiber.Ctx) error {
	// Simple map clear
	newsCache.Range(func(key interface{}, value interface{}) bool {
		newsCache.Delete(key)
		return true
	})
	return c.JSON(fiber.Map{"success": true, "message": "News cache cleared"})
}
