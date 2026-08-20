package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AIRequest struct {
	SystemPrompt string
	Messages     []AIMessage
	MaxTokens    int
	Temperature  float64
}

type AIService interface {
	Complete(context.Context, AIRequest) (string, error)
}

type aiProvider struct {
	endpoint string
	apiKey   string
	model    string
}

type compatibleAIService struct {
	providers []aiProvider
	client    *http.Client
}

// NewAIServiceFromEnv creates a provider-neutral client. Groq is attempted
// first and OpenRouter is a fallback, matching existing StudyBuddy behavior.
func NewAIServiceFromEnv() AIService {
	providers := make([]aiProvider, 0, 2)
	if key := strings.TrimSpace(os.Getenv("GROQ_API_KEY")); key != "" {
		model := strings.TrimSpace(os.Getenv("GROQ_MENTOR_MODEL"))
		if model == "" {
			model = "openai/gpt-oss-120b"
		}
		providers = append(providers, aiProvider{"https://api.groq.com/openai/v1/chat/completions", key, model})
	}
	if key := strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY")); key != "" {
		model := strings.TrimSpace(os.Getenv("OPENROUTER_MENTOR_MODEL"))
		if model == "" {
			model = strings.TrimSpace(os.Getenv("OPENROUTER_MODEL"))
		}
		if model == "" {
			model = "google/gemma-3-27b-it:free"
		}
		providers = append(providers, aiProvider{"https://openrouter.ai/api/v1/chat/completions", key, model})
	}
	return &compatibleAIService{providers: providers, client: &http.Client{Timeout: 35 * time.Second}}
}

func (service *compatibleAIService) Complete(ctx context.Context, input AIRequest) (string, error) {
	if len(service.providers) == 0 {
		return "", errors.New("AI provider is not configured")
	}
	if input.MaxTokens < 1 || input.MaxTokens > 1200 {
		return "", errors.New("invalid output limit")
	}
	messages := make([]AIMessage, 0, len(input.Messages)+1)
	messages = append(messages, AIMessage{Role: "system", Content: input.SystemPrompt})
	messages = append(messages, input.Messages...)
	var lastErr error
	for _, provider := range service.providers {
		text, err := service.completeProvider(ctx, provider, input, messages)
		if err == nil {
			return text, nil
		}
		lastErr = err
	}
	return "", lastErr
}

func (service *compatibleAIService) completeProvider(ctx context.Context, provider aiProvider, input AIRequest, messages []AIMessage) (string, error) {
	payload := struct {
		Model       string      `json:"model"`
		Messages    []AIMessage `json:"messages"`
		Temperature float64     `json:"temperature"`
		MaxTokens   int         `json:"max_tokens"`
	}{provider.model, messages, input.Temperature, input.MaxTokens}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, provider.endpoint, bytes.NewReader(encoded))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+provider.apiKey)
		resp, err := service.client.Do(req)
		if err != nil {
			return "", err
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		if readErr != nil {
			return "", readErr
		}
		if resp.StatusCode == http.StatusTooManyRequests && attempt == 0 {
			delay := time.Second
			if seconds, parseErr := strconv.Atoi(resp.Header.Get("Retry-After")); parseErr == nil && seconds > 0 && seconds <= 5 {
				delay = time.Duration(seconds) * time.Second
			}
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(delay):
			}
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("AI provider returned status %d", resp.StatusCode)
		}
		var parsed struct {
			Choices []struct {
				Message AIMessage `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(body, &parsed); err != nil || len(parsed.Choices) == 0 {
			return "", errors.New("invalid AI provider response")
		}
		text := strings.TrimSpace(parsed.Choices[0].Message.Content)
		if text == "" {
			return "", errors.New("empty AI provider response")
		}
		return text, nil
	}
	return "", errors.New("AI provider is busy")
}
