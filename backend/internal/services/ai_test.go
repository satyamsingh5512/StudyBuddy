package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCompatibleAIServiceCompletesAgainstOpenAIShape(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("authorization header missing")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"  focused answer  "}}]}`))
	}))
	defer server.Close()
	service := &compatibleAIService{providers: []aiProvider{{endpoint: server.URL, apiKey: "test-key", model: "test-model"}}, client: &http.Client{Timeout: time.Second}}
	text, err := service.Complete(context.Background(), AIRequest{SystemPrompt: "bounded", Messages: []AIMessage{{Role: "user", Content: "help"}}, MaxTokens: 100, Temperature: .4})
	if err != nil {
		t.Fatal(err)
	}
	if text != "focused answer" {
		t.Fatalf("text = %q", text)
	}
}

func TestCompatibleAIServiceRejectsOutputLimit(t *testing.T) {
	service := &compatibleAIService{providers: []aiProvider{{apiKey: "x"}}}
	if _, err := service.Complete(context.Background(), AIRequest{MaxTokens: 1201}); err == nil {
		t.Fatal("oversized output accepted")
	}
}
