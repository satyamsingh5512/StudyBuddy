package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
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

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured"})
	}

	prompt := fmt.Sprintf(`System Instructions: You are an educational news curator specializing in competitive exams in India.
User Request: Generate 5 recent and relevant news updates for %s exam aspirants.
Include:
- Exam date announcements
- Syllabus changes
- Important notifications
- Study tips
- Success stories or motivational updates

Return EXACTLY as a JSON array with no markdown formatting:
[
  {
    "title": "News headline",
    "content": "Brief description (2-3 sentences)",
    "category": "announcement",
    "date": "YYYY-MM-DD",
    "source": "Official source or general"
  }
]

Make it realistic and helpful for current %s aspirants.`, examTypeUpper, examTypeUpper)

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.7,
			"maxOutputTokens": 1500,
		},
	}

	reqBytes, _ := json.Marshal(requestBody)

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gemini API request failed"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Gemini API Error: %s", string(bodyBytes))})
	}

	var geminiRes map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&geminiRes); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to decode Gemini response"})
	}

	candidates, ok := geminiRes["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "No candidates from Gemini"})
	}

	contentMap := candidates[0].(map[string]interface{})["content"].(map[string]interface{})
	parts := contentMap["parts"].([]interface{})
	responseText := parts[0].(map[string]interface{})["text"].(string)

	startIdx := strings.Index(responseText, "[")
	endIdx := strings.LastIndex(responseText, "]")

	if startIdx != -1 && endIdx != -1 && endIdx > startIdx {
		jsonStr := responseText[startIdx : endIdx+1]
		var parsedNews interface{}
		if err := json.Unmarshal([]byte(jsonStr), &parsedNews); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse news response"})
		}

		newsCache.Store(examTypeUpper, CachedNews{Data: parsedNews, Timestamp: currentTime})
		return c.JSON(fiber.Map{"news": parsedNews, "cached": false})
	}

	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to extract JSON from response"})
}

func GetNewsDates(c *fiber.Ctx) error {
	examTypeUpper := strings.ToUpper(c.Params("examType"))
	apiKey := os.Getenv("GEMINI_API_KEY")

	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "News service not configured"})
	}

	prompt := fmt.Sprintf(`System Instructions: You are an expert on Indian competitive exam schedules and timelines.
User Request: Provide important dates for %s exam for the current academic year.

Return EXACTLY as a JSON object with no markdown formatting:
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

Include: Registration dates, exam dates, result dates, counseling dates.`, examTypeUpper, examTypeUpper)

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.5,
			"maxOutputTokens": 1000,
		},
	}

	reqBytes, _ := json.Marshal(requestBody)

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gemini API request failed"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Gemini API Error: %s", string(bodyBytes))})
	}

	var geminiRes map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&geminiRes); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to decode Gemini response"})
	}

	candidates, ok := geminiRes["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "No candidates from Gemini"})
	}

	contentMap := candidates[0].(map[string]interface{})["content"].(map[string]interface{})
	parts := contentMap["parts"].([]interface{})
	responseText := parts[0].(map[string]interface{})["text"].(string)

	startIdx := strings.Index(responseText, "{")
	endIdx := strings.LastIndex(responseText, "}")

	if startIdx != -1 && endIdx != -1 && endIdx > startIdx {
		jsonStr := responseText[startIdx : endIdx+1]
		var parsedDates interface{}
		if err := json.Unmarshal([]byte(jsonStr), &parsedDates); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse dates response"})
		}
		return c.JSON(parsedDates)
	}

	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to extract JSON from response"})
}

func ClearNewsCache(c *fiber.Ctx) error {
	// Simple map clear
	newsCache.Range(func(key interface{}, value interface{}) bool {
		newsCache.Delete(key)
		return true
	})
	return c.JSON(fiber.Map{"success": true, "message": "News cache cleared"})
}
