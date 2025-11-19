# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Install Dependencies (Already Done ✅)

```bash
npm install
```

### Step 2: Set Up Database

#### Option A: Use Neon (Easiest - Recommended)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project
3. Copy the connection string
4. Update `.env`:

```env
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

#### Option B: Use Local PostgreSQL

```bash
# Install PostgreSQL if not installed
# Then create database
createdb studybuddy

# Update .env
DATABASE_URL="postgresql://localhost:5432/studybuddy"
```

### Step 3: Push Database Schema

```bash
npm run db:push
```

### Step 4: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: **Web application**
6. Add authorized redirect URI:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
7. Copy Client ID and Client Secret
8. Update `.env`:

```env
GOOGLE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret-here"
```

### Step 5: Get Gemini API Key (Optional for now)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Update `.env`:

```env
GEMINI_API_KEY="your-api-key-here"
```

### Step 6: Start the App

```bash
npm run dev
```

Open http://localhost:5173 in your browser!

## ✅ Verification Checklist

When you start the server, you should see:

```
✅ Server running on http://localhost:3001
📱 Client URL: http://localhost:5173
🗄️  Database: Connected
🔐 Google OAuth: Configured
```

If you see warnings (⚠️), check your `.env` file.

## 🎯 What Works Without Full Setup

- ✅ **Landing Page** - Works immediately, no config needed
- ✅ **Frontend** - All UI components work
- ⚠️ **Authentication** - Needs Google OAuth setup
- ⚠️ **Database Features** - Needs database connection
- ⚠️ **AI Features** - Needs Gemini API key

## 🐛 Common Issues

### "OAuth2Strategy requires a clientID option"

**Solution**: Your `.env` file has placeholder values. Update with real Google OAuth credentials.

### "Database connection failed"

**Solution**: 
1. Check if PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Try using Neon instead (easier)

### Port 3001 or 5173 already in use

**Solution**:
```bash
# Kill the process
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

## 📚 Next Steps

Once running:
1. Click "Get Started" on the landing page
2. Sign in with Google
3. Set your exam goal and date in Settings
4. Start adding tasks and tracking progress!

## 💡 Pro Tips

- Use **Neon** for database - it's free and requires zero local setup
- The app works in **development mode** without HTTPS
- You can skip Gemini API initially - other features work fine
- Check server logs for helpful status messages

## 🆘 Need Help?

1. Check the server console for error messages
2. Verify all `.env` values are set correctly
3. Make sure ports 3001 and 5173 are available
4. See `SETUP.md` for detailed instructions

Happy studying! 📚✨
