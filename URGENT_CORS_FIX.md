# 🚨 URGENT: CORS Fix Deployment Guide

## Problem
Your frontend at `https://sbd.satym.site` cannot connect to the backend because:
1. CORS is blocking the requests
2. 500 errors are occurring before CORS headers are sent
3. Rate limiter was running before health checks

## What Was Fixed

### 1. Added Your Domain to CORS Whitelist
```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://sbd.satym.site',  // ✅ YOUR DOMAIN
  'https://studybuddyone.vercel.app',
  process.env.CLIENT_URL,
];
```

### 2. Moved Health Checks Before Rate Limiting
Health endpoints now respond immediately without rate limiting:
- `/health` - Public health check
- `/api/health` - Public health check
- `/api/health/detailed` - Authenticated health check

### 3. Added Global Error Handler
Ensures CORS headers are sent even when errors occur.

### 4. Added Error Handling to Rate Limiter
Rate limiter failures won't block requests anymore.

## 🚀 Deploy Now (3 Steps)

### Step 1: Commit and Push
```bash
git add .
git commit -m "fix: CORS support for sbd.satym.site + health check fixes"
git push origin main
```

### Step 2: Wait for Render Deployment
- Go to https://dashboard.render.com
- Watch your service deploy (takes 2-3 minutes)
- Wait for "Live" status

### Step 3: Test It Works
```bash
# Test 1: Health check
curl https://studybuddy-backend-5ayj.onrender.com/health

# Test 2: CORS headers
curl -v -H "Origin: https://sbd.satym.site" \
  https://studybuddy-backend-5ayj.onrender.com/health

# Should see:
# < Access-Control-Allow-Origin: https://sbd.satym.site
# < Access-Control-Allow-Credentials: true
```

## ✅ Verify Frontend Works

1. **Clear Browser Cache**
   - Chrome: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   - Or use Incognito/Private mode

2. **Visit Your Site**
   - Go to https://sbd.satym.site
   - Should load without CORS errors

3. **Check Console**
   - Press F12 to open DevTools
   - Go to Console tab
   - Should see: "✅ Server is awake and ready"
   - No CORS errors

## 🔍 If Still Not Working

### Check 1: Verify Deployment
```bash
# Check if changes are deployed
curl https://studybuddy-backend-5ayj.onrender.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Check 2: Check Render Logs
1. Go to https://dashboard.render.com
2. Click your service
3. Click "Logs" tab
4. Look for errors

### Check 3: Verify Environment Variables
Make sure these are set in Render:
- `CLIENT_URL=https://sbd.satym.site`
- `NODE_ENV=production`
- All other required env vars

### Check 4: Test CORS Manually
```bash
# This should work:
curl -H "Origin: https://sbd.satym.site" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://studybuddy-backend-5ayj.onrender.com/api/auth/me
```

## 🆘 Emergency Rollback

If something breaks:

1. Go to Render dashboard
2. Click your service
3. Click "Manual Deploy"
4. Select previous deployment
5. Click "Deploy"

## 📝 What Changed

### Files Modified:
- `server/index.ts`
  - Added `https://sbd.satym.site` to CORS whitelist
  - Moved health checks before rate limiting
  - Added global error handler with CORS headers
  
- `server/middleware/rateLimiting.ts`
  - Added try-catch to prevent rate limiter crashes
  
- `src/lib/serverWakeup.ts`
  - Fixed health check URL from `/health` to `/api/health`

### Why These Changes:
1. **CORS whitelist** - Allows your domain to make requests
2. **Health checks first** - Prevents rate limiting from blocking health checks
3. **Error handler** - Ensures CORS headers are sent even on errors
4. **Rate limiter safety** - Prevents crashes from blocking all requests

## 🎯 Expected Result

After deployment:
- ✅ No CORS errors in browser console
- ✅ Frontend loads successfully
- ✅ Can sign in with Google
- ✅ All API calls work
- ✅ Health checks respond instantly

## 📞 Still Having Issues?

### Check These:
1. Did you push to the correct branch?
2. Is Render deploying from the correct branch?
3. Are all environment variables set?
4. Is the database accessible?
5. Are there any errors in Render logs?

### Quick Debug Commands:
```bash
# Check if server is responding
curl https://studybuddy-backend-5ayj.onrender.com/health

# Check CORS headers
curl -v -H "Origin: https://sbd.satym.site" \
  https://studybuddy-backend-5ayj.onrender.com/health | grep -i "access-control"

# Check if your domain is in the response
curl -v -H "Origin: https://sbd.satym.site" \
  https://studybuddy-backend-5ayj.onrender.com/health 2>&1 | grep "sbd.satym.site"
```

## 🔐 Security Note

The changes maintain security:
- Only specific domains are whitelisted
- Credentials are still required
- Rate limiting is still active (just not on health checks)
- All other security measures remain in place

---

**Status:** Ready to Deploy ✅
**Priority:** URGENT 🚨
**Time to Fix:** 5 minutes (after deployment)

Deploy now and your app will work! 🎉
