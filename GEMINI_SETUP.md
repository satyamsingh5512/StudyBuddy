# Google Gemini API Setup

## Get API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the generated key

## Add to Vercel

### Via Dashboard
1. Go to Vercel project dashboard
2. Settings → Environment Variables
3. Add variable:
   - Name: `GEMINI_API_KEY`
   - Value: Your API key
   - Environment: All (Production, Preview, Development)
4. Save and redeploy

### Via CLI
```bash
vercel env add GEMINI_API_KEY
# Paste key when prompted
# Select all environments
vercel --prod
```

## Verify Setup

1. Open BuddyChat
2. Select "Gemini" from model dropdown
3. Send test message
4. Should receive response from Gemini

## Troubleshooting

**Error: "Gemini AI service not configured"**
- API key not set in Vercel
- Solution: Add GEMINI_API_KEY

**Error: "Gemini AI service error"**
- Invalid API key
- Solution: Generate new key and update

**Auto-switches to Groq**
- Gemini not available
- App falls back to Groq automatically

## API Limits

**Free Tier:**
- 60 requests per minute
- 1,500 requests per day
- Sufficient for most use cases

**Paid Tier:**
- Higher rate limits
- Visit: https://ai.google.dev/pricing

## Security

- Never commit API keys to Git
- Keys stored securely in Vercel
- Rotate keys periodically
