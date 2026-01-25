# Deployment Guide - StudyBuddy

## Problem: 404 Errors on Production

You're getting 404 errors because **Vercel doesn't support long-running Express servers with Socket.IO** in serverless functions. Your app needs a persistent server for real-time chat.

## Solution: Split Frontend & Backend Deployment

Deploy frontend and backend separately for best results.

---

## Option 1: Render (Backend) + Vercel (Frontend) ⭐ RECOMMENDED

### Step 1: Deploy Backend to Render

1. **Go to [Render.com](https://render.com)** and sign up

2. **Create New Web Service**
   - Connect your GitHub repository
   - Select "Web Service"

3. **Configure Service:**
   ```
   Name: studybuddy-api
   Environment: Node
   Build Command: npm install
   Start Command: npm run start:server
   ```

4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_secret_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   GROQ_API_KEY=your_groq_key
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   CLIENT_URL=https://sbd.satym.site
   ```

5. **Deploy** - Render will give you a URL like: `https://studybuddy-api.onrender.com`

### Step 2: Update Frontend Configuration

1. **Add environment variable to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://studybuddy-api.onrender.com/api`

2. **Redeploy frontend** on Vercel

### Step 3: Update Backend CORS

Update `server/index.ts` to allow your frontend domain:

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://sbd.satym.site',  // Your Vercel domain
  'https://studybuddy-api.onrender.com',  // Your Render domain
  process.env.CLIENT_URL,
].filter(Boolean);
```

---

## Option 2: Railway (Backend) + Vercel (Frontend)

### Step 1: Deploy Backend to Railway

1. **Go to [Railway.app](https://railway.app)** and sign up

2. **Create New Project**
   - Connect GitHub repository
   - Select "Deploy from GitHub repo"

3. **Configure:**
   - Railway auto-detects Node.js
   - Add all environment variables (same as Render above)

4. **Get your Railway URL:** `https://studybuddy-api.up.railway.app`

### Step 2: Same as Option 1, Step 2 & 3

---

## Option 3: All-in-One on Render

Deploy both frontend and backend on Render:

### Step 1: Update package.json

Add a build script that builds both:

```json
{
  "scripts": {
    "build:all": "npm run build && npm run build:server",
    "start:prod": "npm run start:server"
  }
}
```

### Step 2: Deploy to Render

1. Create Web Service on Render
2. Build Command: `npm run build:all`
3. Start Command: `npm run start:prod`
4. Add all environment variables
5. Enable "Auto-Deploy"

### Step 3: Serve Static Files

Update `server/index.ts` to serve the built frontend:

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// All other routes serve index.html (for React Router)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  }
});
```

---

## Option 4: Quick Fix - Use Existing Backend

If you already have a backend server running somewhere:

1. **Find your backend URL** (e.g., `https://your-backend.com`)

2. **Add to Vercel Environment Variables:**
   ```
   VITE_API_URL=https://your-backend.com/api
   ```

3. **Redeploy on Vercel**

---

## Current Configuration

Your `vercel.json` is now configured to:
- ✅ Serve static files from `dist` folder
- ✅ Handle React Router routes (SPA)
- ✅ NOT try to run the backend on Vercel

Your `src/config/api.ts` now:
- ✅ Uses `VITE_API_URL` environment variable
- ✅ Falls back to `/api` for local development

---

## Testing After Deployment

1. **Check backend is running:**
   ```bash
   curl https://your-backend-url.com/api/health
   ```
   Should return: `{"status":"ok"}`

2. **Check frontend can reach backend:**
   - Open browser console on `https://sbd.satym.site`
   - Try to sign up/login
   - Check Network tab for API calls
   - Should see requests going to your backend URL

3. **Check WebSocket connection:**
   - Go to Chat page
   - Open browser console
   - Should see: `✅ Socket connected`

---

## Recommended: Render for Backend

**Why Render?**
- ✅ Free tier available
- ✅ Supports long-running Node.js servers
- ✅ Supports WebSockets/Socket.IO
- ✅ Auto-deploys from GitHub
- ✅ Easy environment variable management
- ✅ Built-in SSL certificates
- ✅ No cold starts (unlike Vercel serverless)

**Render Free Tier:**
- 750 hours/month (enough for 1 service running 24/7)
- Spins down after 15 minutes of inactivity
- Spins up automatically on first request (takes ~30 seconds)

---

## Environment Variables Checklist

Make sure these are set on your backend deployment:

```bash
# Required
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=random-secret-key-change-this

# OAuth (if using Google login)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# File uploads (if using Cloudinary)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# AI features (if using Groq)
GROQ_API_KEY=...

# Email (if using email verification)
EMAIL_USER=...
EMAIL_PASS=...

# Frontend URL (for CORS)
CLIENT_URL=https://sbd.satym.site

# Optional: Redis (for chat caching)
REDIS_URL=redis://...
```

---

## Next Steps

1. **Choose a deployment option** (Render recommended)
2. **Deploy backend** to chosen platform
3. **Get backend URL** from deployment
4. **Add `VITE_API_URL` to Vercel** environment variables
5. **Redeploy frontend** on Vercel
6. **Test** signup/login/chat

---

## Troubleshooting

### Still getting 404?
- Check `VITE_API_URL` is set correctly in Vercel
- Check backend is running (visit backend URL in browser)
- Check CORS settings in `server/index.ts`

### CORS errors?
- Add your frontend domain to `allowedOrigins` in `server/index.ts`
- Make sure `credentials: 'include'` is in fetch requests

### Chat not connecting?
- Check WebSocket support on your backend platform
- Render and Railway support WebSockets
- Vercel serverless does NOT support WebSockets

---

**Need Help?** Check the logs on your backend deployment platform for errors.
