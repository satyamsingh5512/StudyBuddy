# AI Model Selector - BuddyChat

## Overview
BuddyChat supports multiple AI models, allowing users to choose between different AI providers.

## Supported Models

### Groq (Llama 3.3 70B)
- Model: `llama-3.3-70b-versatile`
- Speed: Very fast responses
- Best for: Quick task generation, general study advice
- API Key: `GROQ_API_KEY`

### Google Gemini (Gemini Pro)
- Model: `gemini-pro`
- Speed: Fast responses
- Best for: Detailed explanations, comprehensive study plans
- API Key: `GEMINI_API_KEY`

## Features

- Model switching mid-conversation
- Visual indicator of active model
- Fallback handling if API key not configured
- Same features across both models:
  - General conversation
  - Task generation
  - Study advice
  - Motivational support

## API Endpoint

### POST `/api/ai/buddy-chat`

Request:
```json
{
  "message": "Create 5 physics tasks for me",
  "examGoal": "NEET",
  "model": "groq"
}
```

Response:
```json
{
  "response": "I've created some physics tasks for you!",
  "tasks": [...],
  "provider": "groq"
}
```

## Implementation

**Files Modified/Created:**
- `server/lib/geminiClient.ts` - Gemini API integration
- `server/routes/ai.ts` - Model routing logic
- `src/components/BuddyChat.tsx` - Model selector UI
- `.env` - Added GEMINI_API_KEY
- `package.json` - Added @google/generative-ai

## Error Handling

- Missing API key: Clear error message
- Network errors: Toast notifications
- Invalid responses: Graceful fallback
- Auto-switch on failure

## Testing

1. Test Groq: Ensure GROQ_API_KEY is set, select Groq, send message
2. Test Gemini: Add GEMINI_API_KEY, select Gemini, send message
3. Test switching: Start with one model, switch to another mid-conversation
