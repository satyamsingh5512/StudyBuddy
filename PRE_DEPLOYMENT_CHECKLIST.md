# ✅ Pre-Deployment Checklist

## Before You Start

### 1. Gather Required Information
- [ ] MongoDB connection string
- [ ] Google OAuth credentials (Client ID & Secret)
- [ ] Groq API key
- [ ] Gmail app password
- [ ] GitHub repository URL

### 2. Test Locally
```bash
# Test frontend build
npm run build
# Should complete without errors

# Test backend
npm run start:server
# Should start without errors
```

---

## Part 1: Deploy Backend to Render

### Step 1: Create Render Account
- [ ] Go to https://render.com
- [ ] Sign up with GitHub
- [ ] Connect GitHub account

### Step 2: Create Web Service
- [ ] Click "New +" → "Web Service"
- [ ] Select your repository
- [ ] Configure:
  - Name: `studybuddy-backend`
  - Environment: `Node`
  - Build Command: `npm install`
  - Start Command: `npm run start:server`
  - Instance: Starter ($7/month recommended)

### Step 3: Add Environment Variables
Copy from `.env.production.example` and add to Render:

- [ ] `NODE_ENV=production`
- [ ] `PORT=3001`
- [ ] `MONGODB_URI=...`
- [ ] `SESSION_SECRET=...` (generate random 32+ char string)
- [ ] `GOOGLE_CLIENT_ID=...`
- [ ] `GOOGLE_CLIENT_SECRET=...`
- [ ] `GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback`
- [ ] `GROQ_API_KEY=...`
- [ ] `EMAIL_USER=...`
- [ ] `EMAIL_PASS=...`
- [ ] `CLIENT_URL=https://sbd.satym.site`
- [ ] `ALLOWED_ORIGINS=https://sbd.satym.site,https://studybuddyone.vercel.app`

### Step 4: Deploy & Test
- [ ] Click "Create Web Service"
- [ ] Wait for deployment (5-10 minutes)
- [ ] Copy your Render URL: `https://__________.onrender.com`
- [ ] Test: `curl https://your-app.onrender.com/api/health`
- [ ] Should return: `{"status":"ok"}`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Install Vercel CLI (Optional)
```bash
npm install -g vercel
vercel login
```

### Step 2: Add Environment Variable
- [ ] Go to Vercel Dashboard
- [ ] Create new project or select existing
- [ ] Settings → Environment Variables
- [ ] Add:
  ```
  Name: VITE_API_URL
  Value: https://your-app.onrender.com/api
  ```
  (Use your actual Render URL)

### Step 3: Deploy
**Option A: CLI**
```bash
npm run build
vercel --prod
```

**Option B: Dashboard**
- [ ] Import GitHub repository
- [ ] Framework: Vite
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Deploy

### Step 4: Test
- [ ] Visit your Vercel URL
- [ ] Open browser console (F12)
- [ ] Check Network tab
- [ ] API calls should go to Render

---

## Part 3: Update OAuth & Database

### Google OAuth
- [ ] Go to https://console.cloud.google.com
- [ ] Select your project
- [ ] APIs & Services → Credentials
- [ ] Edit OAuth 2.0 Client
- [ ] Add redirect URIs:
  ```
  https://your-app.onrender.com/api/auth/google/callback
  https://sbd.satym.site/auth/callback
  ```
- [ ] Save

### MongoDB Atlas
- [ ] Go to MongoDB Atlas
- [ ] Network Access
- [ ] Add IP: `0.0.0.0/0` (allow all)
- [ ] Confirm

### Update Render Environment
- [ ] Update `GOOGLE_CALLBACK_URL` with actual Render URL
- [ ] Update `CLIENT_URL` with actual Vercel URL
- [ ] Update `ALLOWED_ORIGINS` with actual Vercel URL
- [ ] Save (service will restart)

---

## Part 4: Final Testing

### Backend Tests
```bash
# Health check
curl https://your-app.onrender.com/api/health

# CORS test
curl -H "Origin: https://sbd.satym.site" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-app.onrender.com/api/auth/signup
```

### Frontend Tests
- [ ] Visit your site
- [ ] Signup with email
- [ ] Verify OTP
- [ ] Complete onboarding
- [ ] Test chat (send message)
- [ ] Open in another browser
- [ ] Login as different user
- [ ] Test real-time chat
- [ ] Test all features

### Feature Checklist
- [ ] Authentication (signup/login)
- [ ] Email OTP verification
- [ ] Onboarding flow
- [ ] Dashboard
- [ ] Chat (real-time)
- [ ] Friends (search/add)
- [ ] Messages
- [ ] Schedule
- [ ] Reports
- [ ] Settings

---

## Common Issues & Solutions

### Issue: Backend not responding
**Solution:**
1. Check Render logs
2. Verify MongoDB connection
3. Check all env vars are set

### Issue: CORS errors
**Solution:**
1. Verify `CLIENT_URL` in Render
2. Verify `ALLOWED_ORIGINS` includes Vercel URL
3. Verify `VITE_API_URL` in Vercel

### Issue: Socket.IO not connecting
**Solution:**
1. Check `VITE_API_URL` in Vercel
2. Check browser console for errors
3. Verify WebSocket support (Render supports it)

### Issue: 404 on API calls
**Solution:**
1. Verify `VITE_API_URL` is set in Vercel
2. Verify backend is deployed
3. Check Render logs

---

## Post-Deployment

### Monitor
- [ ] Check Render logs for errors
- [ ] Check Vercel analytics
- [ ] Monitor MongoDB usage
- [ ] Test all features daily

### Optimize
- [ ] Consider upgrading Render to Starter ($7/month)
- [ ] Add Redis for better performance
- [ ] Set up error tracking (Sentry)
- [ ] Add uptime monitoring

### Backup
- [ ] Export MongoDB data regularly
- [ ] Keep environment variables backed up
- [ ] Document any custom configurations

---

## Quick Reference

### URLs
- **Frontend**: https://sbd.satym.site
- **Backend**: https://your-app.onrender.com
- **Health Check**: https://your-app.onrender.com/api/health

### Dashboards
- **Vercel**: https://vercel.com/dashboard
- **Render**: https://dashboard.render.com
- **MongoDB**: https://cloud.mongodb.com
- **Google Cloud**: https://console.cloud.google.com

### Commands
```bash
# Deploy frontend
npm run build
vercel --prod

# Test backend
curl https://your-app.onrender.com/api/health

# Check logs
# Render Dashboard → Your Service → Logs
```

---

## ✅ Deployment Complete!

When all checkboxes are checked:
- ✅ Backend deployed to Render
- ✅ Frontend deployed to Vercel
- ✅ Environment variables configured
- ✅ OAuth callbacks updated
- ✅ MongoDB accessible
- ✅ All features tested
- ✅ No errors in logs

**Your app is live!** 🎉

---

**Estimated Time**: 30-45 minutes  
**Cost**: $0-7/month  
**Difficulty**: Medium

**Need help?** Check `DEPLOYMENT_STEPS.md` for detailed instructions.
