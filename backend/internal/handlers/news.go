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

const defaultGeminiModel = "gemini-1.5-flash"

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

func getGeminiModel() string {
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		return defaultGeminiModel
	}
	return model
}

func getGeminiAPIKey() string {
	if key := strings.TrimSpace(os.Getenv("GEMINI_API_KEY")); key != "" {
		return key
	}
	if key := strings.TrimSpace(os.Getenv("GOOGLE_API_KEY")); key != "" {
		return key
	}
	return ""
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
		return nil, errors.New("empty or invalid news payload from Gemini")
	}

	return normalized, nil
}

func callGeminiJSON(apiKey, model, systemInstruction, userPrompt string, temperature float64, maxOutputTokens int) (string, error) {
	requestBody := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]string{
				{"text": systemInstruction},
			},
		},
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]string{
					{"text": userPrompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      temperature,
			"maxOutputTokens":  maxOutputTokens,
			"responseMimeType": "application/json",
		},
	}

	reqBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiRes map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &geminiRes); err != nil {
		return "", err
	}

	candidates, ok := geminiRes["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return "", errors.New("no candidates from Gemini")
	}

	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return "", errors.New("invalid candidate payload from Gemini")
	}

	contentMap, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return "", errors.New("missing content in Gemini response")
	}

	parts, ok := contentMap["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return "", errors.New("missing content parts in Gemini response")
	}

	part, ok := parts[0].(map[string]interface{})
	if !ok {
		return "", errors.New("invalid content part from Gemini")
	}

	text, ok := part["text"].(string)
	if !ok || strings.TrimSpace(text) == "" {
		return "", errors.New("empty text response from Gemini")
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

func GetNews(c *fiber.Ctx) error {
	examTypeUpper := strings.ToUpper(c.Params("examType"))
	validExams := []string{"JEE", "NEET", "GATE", "UPSC", "CAT", "NDA", "CLAT"}

	isValid := false
	for _, exam := range validExams {
		if exam == examTypeUpper {
			isValid = true
			break
		}
	}

	if !isValid {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid exam type"})
	}

	currentTime := time.Now().UnixMilli()
	if val, ok := newsCache.Load(examTypeUpper); ok {
		cachedEntry := val.(CachedNews)
		if currentTime-cachedEntry.Timestamp < CACHE_DURATION {
			return c.JSON(fiber.Map{"news": cachedEntry.Data, "cached": true})
		}
	}

	apiKey := getGeminiAPIKey()
	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GEMINI_API_KEY."})
	}

	systemInstruction := "You are StudyBuddy's exam news assistant for Indian competitive exams. Return only valid JSON without markdown."
	prompt := fmt.Sprintf(`Generate exactly 5 useful updates for %s aspirants in India.
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
- No markdown, no backticks, no extra keys.
- Date must be YYYY-MM-DD.
- Keep each item relevant to %s.`, examTypeUpper, examTypeUpper)

	responseText, err := callGeminiJSON(apiKey, getGeminiModel(), systemInstruction, prompt, 0.6, 1500)
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
	apiKey := getGeminiAPIKey()

	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured. Set GEMINI_API_KEY."})
	}

	systemInstruction := "You are StudyBuddy's exam timeline assistant for Indian competitive exams. Return only valid JSON without markdown."
	prompt := fmt.Sprintf(`Provide key dates for the current %s exam cycle in India.
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
- Include registration, exam, result, and counseling milestones when applicable.
- No markdown, no backticks, no extra keys.
- Date must be YYYY-MM-DD.`, examTypeUpper, examTypeUpper)

	responseText, err := callGeminiJSON(apiKey, getGeminiModel(), systemInstruction, prompt, 0.4, 1000)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var parsedDates interface{}
	if err := parseJSONWithFallback(responseText, "{", "}", &parsedDates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Gemini dates response"})
	}

	return c.JSON(parsedDates)
}

func ClearNewsCache(c *fiber.Ctx) error {
	// Simple map clear
	newsCache.Range(func(key interface{}, value interface{}) bool {
		newsCache.Delete(key)
		return true
	})
	return c.JSON(fiber.Map{"success": true, "message": "News cache cleared"})
}
