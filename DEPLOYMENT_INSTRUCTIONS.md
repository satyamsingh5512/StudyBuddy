# Complete Deployment Instructions

## Problem
Your app has a **frontend** (React) and **backend** (Express + Socket.io). Vercel can only host the frontend. The backend needs a separate server.

## Solution: Split Deployment

### Part 1: Deploy Backend to Render

#### Step 1: Prepare for Deployment
```bash
git add .
git commit -m "Prepare for split deployment"
git push origin main
```

#### Step 2: Create Render Account
1. Go to https://render.com/
2. Sign up with your GitHub account

#### Step 3: Create New Web Service
1. Click **New +** → **Web Service**
2. Connect your `StudyBuddy` repository
3. Configure:
   - **Name**: `studybuddy-backend`
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm install && npm run build:server && npx prisma generate`
   - **Start Command**: `npm run start:server`
   - **Instance Type**: **Free**

#### Step 4: Add Environment Variables in Render
Click **Environment** tab and add:

```
DATABASE_URL=<your_neon_database_url_from_.env>

GOOGLE_CLIENT_ID=<your_google_client_id_from_.env>

GOOGLE_CLIENT_SECRET=<your_google_client_secret_from_.env>

GOOGLE_CALLBACK_URL=https://studybuddy-backend.onrender.com/api/auth/google/callback

SESSION_SECRET=<your_session_secret_from_.env>

GEMINI_API_KEY=<your_gemini_api_key_from_.env>

CLOUDINARY_CLOUD_NAME=<your_cloudinary_cloud_name>
CLOUDINARY_API_KEY=<your_cloudinary_api_key>
CLOUDINARY_API_SECRET=<your_cloudinary_api_secret>

NODE_ENV=production

CLIENT_URL=https://study-buddy-beta-one.vercel.app

PORT=3001
```

**Copy these values from your local `.env` file**

**Note**: Replace `studybuddy-backend` with your actual Render service name if different.

#### Step 5: Deploy
Click **Create Web Service** and wait for deployment (5-10 minutes).

Your backend URL will be: `https://studybuddy-backend.onrender.com`

---

### Part 2: Update Google OAuth

#### Step 1: Add Render URL to Google Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://studybuddy-backend.onrender.com/api/auth/google/callback
   ```
5. Under **Authorized JavaScript origins**, add:
   ```
   https://studybuddy-backend.onrender.com
   ```
6. Click **Save**

---

### Part 3: Update Frontend (Vercel)

#### Step 1: Add Environment Variable in Vercel
1. Go to Vercel Dashboard
2. Select your `study-buddy` project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://studybuddy-backend.onrender.com`
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

#### Step 2: Redeploy Frontend
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Click **Redeploy**

---

## Testing

### Test Backend
Visit: `https://studybuddy-backend.onrender.com/api/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

### Test Frontend
1. Visit: `https://study-buddy-beta-one.vercel.app`
2. Click "Sign in with Google"
3. Should redirect to Google OAuth
4. After login, should redirect back to your app

---

## Important Notes

### Render Free Tier
- Spins down after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds (cold start)
- For production, upgrade to paid tier ($7/month) for always-on service

### CORS Issues
If you see CORS errors:
1. Check `CLIENT_URL` in Render matches your Vercel URL exactly
2. Ensure no trailing slashes
3. Check browser console for exact error

### Database Connection
- Your Neon database is already configured
- Render will connect automatically using `DATABASE_URL`

---

## Quick Reference

### URLs
- **Frontend**: https://study-buddy-beta-one.vercel.app
- **Backend**: https://studybuddy-backend.onrender.com
- **Database**: Neon PostgreSQL (already configured)

### Environment Variables Summary

**Render (Backend)**:
- All database, OAuth, API keys
- `CLIENT_URL` = Vercel frontend URL

**Vercel (Frontend)**:
- `VITE_API_URL` = Render backend URL

---

## Troubleshooting

### "Failed to fetch" errors
- Backend is sleeping (wait 60 seconds)
- Check Render logs for errors

### OAuth redirect errors
- Verify Google Console has correct callback URLs
- Check `GOOGLE_CALLBACK_URL` in Render

### Database errors
- Check Render logs
- Verify `DATABASE_URL` is correct
- Run `npx prisma generate` in Render build

---

## Alternative: Deploy Backend to Railway

If Render doesn't work, try Railway:

1. Go to https://railway.app/
2. Sign in with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. Add same environment variables
6. Railway will auto-detect and deploy

Railway URL format: `https://studybuddy-backend.up.railway.app`

---

Need help? Check the logs:
- **Render**: Dashboard → Your Service → Logs
- **Vercel**: Dashboard → Your Project → Deployments → View Function Logs
