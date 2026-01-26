# Quick Deploy Guide: Connect Vercel Frontend to Render Backend

## 🎯 3-Step Setup

### Step 1: Get Your Render Backend URL
1. Go to https://dashboard.render.com
2. Find your StudyBuddy service
3. Copy the URL (e.g., `https://studybuddy-xyz.onrender.com`)

### Step 2: Configure Vercel
1. Go to https://vercel.com/dashboard
2. Import your GitHub repo (or use existing project)
3. Go to **Settings** → **Environment Variables**
4. Add:
   - Name: `VITE_API_URL`
   - Value: `https://studybuddy-xyz.onrender.com` (your Render URL)
   - Environments: Production ✓ Preview ✓ Development ✓
5. Click **Save**

### Step 3: Update Render CORS
1. Go to Render Dashboard → Your Service → **Environment**
2. Add these variables:
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (your Vercel URL)
   - `FRONTEND_URL` = `https://your-app.vercel.app`
3. Click **Save Changes** (service will restart)

## 🚀 Deploy

### Option A: GitHub Auto-Deploy (Recommended)
- Just push to GitHub
- Vercel will auto-deploy

### Option B: Manual Deploy
```bash
npm i -g vercel
vercel login
vercel --prod
```

## ✅ Test Connection

After deployment, open browser console on your Vercel app:

```javascript
fetch(window.location.origin.replace('your-app', 'studybuddy-xyz') + '/api/health')
  .then(r => r.json())
  .then(console.log);
```

Should return: `{"status":"ok",...}`

## 🔧 Troubleshooting

**CORS Error?**
- Double-check `ALLOWED_ORIGINS` on Render includes your Vercel URL
- Restart Render service after adding env vars

**404 Error?**
- Verify `VITE_API_URL` is set in Vercel
- Check it doesn't have trailing slash

**Slow First Load?**
- Render free tier sleeps after 15 min inactivity
- First request wakes it up (takes ~30 seconds)
- Use keep-alive workflow in `.github/workflows/keep-alive.yml`

## 📋 Full Environment Variables

### Vercel
```
VITE_API_URL=https://studybuddy-xyz.onrender.com
```

### Render
```
ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=your-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GROQ_API_KEY=...
NODE_ENV=production
```

## 📚 More Help
- See `VERCEL_SETUP.md` for detailed instructions
- See `CONNECTION_TEST.md` for testing guide
- Run `./deploy-vercel.sh` for guided deployment
