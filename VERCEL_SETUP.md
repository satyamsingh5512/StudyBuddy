# Vercel Frontend Setup Guide

## Step 1: Get Your Render Backend URL

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your StudyBuddy web service
3. Copy the URL (it should look like: `https://studybuddy-xxxx.onrender.com`)

## Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your StudyBuddy project
3. Go to **Settings** → **Environment Variables**
4. Add the following variable:

   **Variable Name:** `VITE_API_URL`
   **Value:** `https://your-render-app.onrender.com` (replace with your actual Render URL)
   **Environment:** Production, Preview, Development (select all)

5. Click **Save**

## Step 3: Update CORS on Render Backend

Your backend needs to allow requests from your Vercel domain.

1. Go to Render dashboard → Your web service → **Environment**
2. Add/Update these environment variables:

   **FRONTEND_URL:** `https://your-vercel-app.vercel.app`
   **CORS_ORIGIN:** `https://your-vercel-app.vercel.app`

3. Your backend should already have CORS configured in `server/app.ts`

## Step 4: Deploy to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option B: Deploy via GitHub Integration

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add the environment variable `VITE_API_URL` (from Step 2)
5. Click **Deploy**

## Step 5: Verify Connection

After deployment:

1. Open your Vercel app URL
2. Open browser DevTools (F12) → Network tab
3. Try to login or make any API call
4. Check that requests are going to your Render backend URL
5. Check for CORS errors in the console

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` is set correctly on Render
- Verify CORS configuration in `server/app.ts`
- Check that credentials are included in requests

### API Connection Issues
- Verify `VITE_API_URL` is set in Vercel
- Check Render logs for incoming requests
- Ensure Render service is running

### Session/Auth Issues
- Make sure `credentials: 'include'` is in all API calls
- Check cookie settings (SameSite, Secure)
- Verify session store (MongoDB) is accessible from Render

## Quick Test

After setup, test the connection:

```bash
# From your local machine
curl https://your-render-app.onrender.com/api/health

# Should return: {"status":"ok"}
```

## Environment Variables Summary

### Vercel (Frontend)
- `VITE_API_URL` → Your Render backend URL

### Render (Backend)
- `FRONTEND_URL` → Your Vercel frontend URL
- `CORS_ORIGIN` → Your Vercel frontend URL
- All other env vars from your `.env` file
