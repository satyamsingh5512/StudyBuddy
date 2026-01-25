# 🚀 Render + Vercel Deployment Guide

## Architecture

```
Frontend (Vercel)          Backend (Render)
https://sbd.satym.site --> https://studybuddy-api.onrender.com
     │                              │
     │                              ├─ Express Server
     │                              ├─ Socket.IO (Real-time chat)
     │                              ├─ MongoDB Connection
     │                              └─ All API Routes
     │
     └─ Static React App
```

---

## Part 1: Deploy Backend to Render

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select your StudyBuddy repo

### Step 3: Configure Service

**Basic Settings:**
```
Name: studybuddy-api
Environment: Node
Region: Choose closest to your users
Branch: main
```

**Build & Start Commands:**
```
Build Command: npm install
Start Command: npm run start:server
```

**Instance Type:**
- Free (for testing) - Spins down after 15 min
- Starter ($7/month) - Always on, better performance ⭐ RECOMMENDED

### Step 4: Add Environment Variables

Click "Environment" tab and add these:

```bash
# Required
NODE_ENV=production
PORT=3001

# Database
MONGODB_URI=mongodb+srv://studybuddy5512_db_user:Iwillbe@cluster0.tcd7xh3.mongodb.net/studybuddy?retryWrites=true&w=majority

# Session
SESSION_SECRET=your-random-secret-key-min-32-chars

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://studybuddy-api.onrender.com/api/auth/google/callback

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI
GROQ_API_KEY=your_groq_api_key

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Frontend URL (Vercel)
CLIENT_URL=https://sbd.satym.site
ALLOWED_ORIGINS=https://sbd.satym.site,https://studybuddyone.vercel.app

# Optional: Redis (for better chat performance)
# REDIS_URL=redis://...
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes first time)
3. Your backend URL: `https://studybuddy-api.onrender.com`

### Step 6: Test Backend
```bash
curl https://studybuddy-api.onrender.com/api/health
```
Should return: `{"status":"ok"}`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Add Environment Variable to Vercel

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:

```
VITE_API_URL=https://studybuddy-api.onrender.com/api
```

### Step 2: Redeploy Frontend

**Option A: Auto-deploy (if connected to GitHub)**
```bash
git add .
git commit -m "Configure for Render backend"
git push origin main
```

**Option B: Manual deploy**
```bash
vercel --prod
```

### Step 3: Test Frontend
1. Visit `https://sbd.satym.site`
2. Open browser console
3. Try to login/signup
4. Check Network tab - API calls should go to Render

---

## Part 3: Update OAuth Callbacks

### Google OAuth Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Edit your OAuth 2.0 Client
4. Add authorized redirect URIs:
   ```
   https://studybuddy-api.onrender.com/api/auth/google/callback
   https://sbd.satym.site/api/auth/google/callback
   ```

---

## Part 4: MongoDB Atlas Configuration

### Whitelist Render IPs
1. Go to MongoDB Atlas
2. Network Access
3. Add IP Address: `0.0.0.0/0` (allow all)
   - Or add specific Render IPs (check Render docs)

---

## Testing Checklist

### Backend Tests
```bash
# Health check
curl https://studybuddy-api.onrender.com/api/health

# CORS test
curl -H "Origin: https://sbd.satym.site" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://studybuddy-api.onrender.com/api/auth/signup
```

### Frontend Tests
1. ✅ Visit `https://sbd.satym.site`
2. ✅ Signup with email
3. ✅ Verify OTP
4. ✅ Complete onboarding
5. ✅ Test chat (real-time)
6. ✅ Test all features

### Chat Tests
1. Open chat in two browser windows
2. Send message in one window
3. Should appear instantly in other window
4. Check typing indicators
5. Check online status

---

## Performance Optimization

### Render Free Tier
**Pros:**
- ✅ Free
- ✅ Real-time Socket.IO
- ✅ Good for testing

**Cons:**
- ⚠️ Spins down after 15 min inactivity
- ⚠️ 30-50 second cold start
- ⚠️ Shared resources

**Solution:** Upgrade to Starter ($7/month) for production

### Render Starter Tier ($7/month)
**Pros:**
- ✅ Always on (no cold starts)
- ✅ Better performance
- ✅ More resources
- ✅ Professional

**Cons:**
- 💰 $7/month

---

## Monitoring

### Render Dashboard
- Check logs for errors
- Monitor CPU/Memory usage
- Check response times

### Vercel Dashboard
- Enable Analytics
- Monitor page load times
- Check error rates

### MongoDB Atlas
- Monitor connection count
- Check query performance
- Monitor storage usage

---

## Troubleshooting

### Issue: Backend not responding
**Check:**
1. Render logs for errors
2. MongoDB connection
3. Environment variables set correctly

**Solution:**
```bash
# Check Render logs
# Go to Render Dashboard → Your Service → Logs
```

### Issue: CORS errors
**Check:**
1. `CLIENT_URL` set in Render
2. `ALLOWED_ORIGINS` includes your Vercel domain
3. Frontend using correct backend URL

**Solution:**
Update `ALLOWED_ORIGINS` in Render:
```
ALLOWED_ORIGINS=https://sbd.satym.site,https://studybuddyone.vercel.app
```

### Issue: Socket.IO not connecting
**Check:**
1. Backend URL in frontend
2. WebSocket support enabled (Render supports it)
3. CORS configured correctly

**Solution:**
Check browser console for connection errors

### Issue: Cold starts (Free tier)
**Symptoms:**
- First request after 15 min takes 30-50 seconds
- Subsequent requests are fast

**Solutions:**
1. **Upgrade to Starter** ($7/month) - No cold starts
2. **Keep-alive ping** - Ping your backend every 10 minutes
3. **Accept it** - Only affects first user after inactivity

---

## Keep-Alive Solution (Free Tier)

If using free tier, you can prevent cold starts with a cron job:

### Option 1: Use Render Cron Job (Free)
1. Create new Cron Job in Render
2. Command: `curl https://studybuddy-api.onrender.com/api/health`
3. Schedule: Every 10 minutes

### Option 2: Use External Service
- [UptimeRobot](https://uptimerobot.com) - Free
- [Cron-job.org](https://cron-job.org) - Free
- Ping your backend every 10 minutes

---

## Cost Breakdown

### Free Setup
- Vercel: Free
- Render: Free (with cold starts)
- MongoDB Atlas: Free (512MB)
- **Total: $0/month**

### Recommended Setup
- Vercel: Free
- Render Starter: $7/month
- MongoDB Atlas: Free (512MB)
- **Total: $7/month**

### Professional Setup
- Vercel Pro: $20/month
- Render Standard: $25/month
- MongoDB Atlas M10: $57/month
- **Total: $102/month**

---

## Scaling

### When to upgrade Render:
- ⚠️ Cold starts annoying users
- ⚠️ Response times > 1 second
- ⚠️ More than 100 concurrent users
- ⚠️ Running out of memory

### When to upgrade MongoDB:
- ⚠️ Storage > 400MB
- ⚠️ Slow queries
- ⚠️ Connection limits reached

---

## Backup Plan

### If Render is down:
1. Check [Render Status](https://status.render.com)
2. Check your service logs
3. Restart service if needed

### If MongoDB is down:
1. Check [MongoDB Atlas Status](https://status.mongodb.com)
2. Check connection string
3. Check IP whitelist

---

## Success Criteria

✅ Backend deployed to Render
✅ Frontend deployed to Vercel
✅ Backend URL configured in Vercel
✅ OAuth callbacks updated
✅ MongoDB accessible from Render
✅ Health endpoint returns 200
✅ Can signup/login
✅ Real-time chat works
✅ All features functional

---

## Next Steps

1. **Deploy backend to Render** (follow Part 1)
2. **Get Render URL** (e.g., `https://studybuddy-api.onrender.com`)
3. **Add to Vercel** as `VITE_API_URL`
4. **Redeploy frontend**
5. **Test everything**
6. **Monitor for 24 hours**
7. **Consider upgrading** to Starter if cold starts are annoying

---

## Support

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Socket.IO Docs:** https://socket.io/docs/

---

**Ready to deploy!** 🚀
