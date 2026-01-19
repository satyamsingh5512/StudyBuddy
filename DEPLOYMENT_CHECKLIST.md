# Deployment Checklist

## 🚀 Quick Fix for Current CORS Issue

Your frontend at `https://sbd.satym.site` is blocked because the backend needs to be updated with the new CORS configuration.

### Immediate Steps:

1. **Deploy Backend Changes**
   ```bash
   git add .
   git commit -m "fix: Add CORS support for sbd.satym.site"
   git push
   ```

2. **Verify on Render**
   - Go to https://dashboard.render.com
   - Your service should auto-deploy
   - Wait for deployment to complete (~2-3 minutes)

3. **Test CORS**
   ```bash
   curl -H "Origin: https://sbd.satym.site" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        https://studybuddy-backend-5ayj.onrender.com/api/health
   ```

4. **Refresh Frontend**
   - Clear browser cache (Ctrl+Shift+R)
   - Reload https://sbd.satym.site
   - Should work now! ✅

---

## 📋 Full Deployment Checklist

### Backend (Render.com)

#### Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL/CockroachDB connection string
- [ ] `SESSION_SECRET` - Random secure string
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [ ] `CLIENT_URL` - Frontend URL (https://sbd.satym.site)
- [ ] `GROQ_API_KEY` - Groq AI API key
- [ ] `GEMINI_API_KEY` - Google Gemini key (optional fallback)
- [ ] `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` - Cloudinary API key
- [ ] `CLOUDINARY_API_SECRET` - Cloudinary API secret
- [ ] `NODE_ENV` - Set to "production"
- [ ] `ALLOWED_ORIGINS` - Additional domains (optional)

#### Build Settings
- [ ] Build Command: `npm install && npm run db:generate`
- [ ] Start Command: `npm run start:server`
- [ ] Node Version: 18.x or higher

#### Health Check
- [ ] Health Check Path: `/health` or `/api/health`
- [ ] Expected Status: 200

### Frontend (Vercel/Custom)

#### Environment Variables
- [ ] `VITE_API_URL` - Backend URL (https://studybuddy-backend-5ayj.onrender.com)

#### Build Settings
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### Database (CockroachDB/PostgreSQL)

- [ ] Database created and accessible
- [ ] Connection string added to backend env
- [ ] Migrations run: `npm run db:push`
- [ ] Tables created successfully

### Google OAuth

- [ ] OAuth consent screen configured
- [ ] Authorized redirect URIs added:
  - `https://studybuddy-backend-5ayj.onrender.com/api/auth/google/callback`
  - `http://localhost:3001/api/auth/google/callback` (for local dev)
- [ ] Credentials added to backend env

### Groq AI

- [ ] API key obtained from console.groq.com
- [ ] Key added to backend env
- [ ] Test task generation endpoint

### Cloudinary

- [ ] Account created
- [ ] Upload preset configured (optional)
- [ ] Credentials added to backend env

---

## 🧪 Testing After Deployment

### 1. Health Check
```bash
curl https://studybuddy-backend-5ayj.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. CORS Test
```bash
curl -H "Origin: https://sbd.satym.site" \
     https://studybuddy-backend-5ayj.onrender.com/api/health
# Should include: Access-Control-Allow-Origin header
```

### 3. Auth Test
- Visit https://sbd.satym.site
- Click "Sign in with Google"
- Should redirect and authenticate successfully

### 4. API Test
```bash
# Test rate limiting
curl https://studybuddy-backend-5ayj.onrender.com/api/health
# Check for X-RateLimit-* headers
```

### 5. Frontend Test
- [ ] Landing page loads
- [ ] Google sign-in works
- [ ] Dashboard loads after login
- [ ] Task creation works
- [ ] AI task generation works
- [ ] News page loads
- [ ] Chat/messaging works
- [ ] File upload works

---

## 🔧 Common Issues & Fixes

### Issue: CORS Error
**Symptom:** "No 'Access-Control-Allow-Origin' header"

**Fix:**
1. Add your domain to allowed origins in `server/index.ts`
2. Or set `ALLOWED_ORIGINS` environment variable
3. Redeploy backend

### Issue: 500 Internal Server Error
**Symptom:** All API requests return 500

**Fix:**
1. Check Render logs for errors
2. Verify all environment variables are set
3. Check database connection
4. Ensure migrations are run

### Issue: OAuth Not Working
**Symptom:** "OAuth is not configured" error

**Fix:**
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Check redirect URI in Google Console matches backend URL
3. Ensure credentials are not placeholder values

### Issue: Database Connection Failed
**Symptom:** "Failed to connect to database"

**Fix:**
1. Verify `DATABASE_URL` is correct
2. Check database is accessible from Render
3. Ensure IP whitelist includes Render IPs (if using CockroachDB)
4. Test connection string locally

### Issue: Rate Limiting Too Strict
**Symptom:** "Too many requests" errors frequently

**Fix:**
1. Adjust limits in `server/middleware/rateLimiting.ts`
2. Consider using Redis for distributed rate limiting
3. Whitelist specific IPs if needed

### Issue: Cold Start Delays
**Symptom:** First request takes 30+ seconds

**Fix:**
1. Upgrade to paid Render plan (no cold starts)
2. Or use keep-alive service (already implemented)
3. Or accept 30s delay on first request

---

## 🎯 Performance Optimization

### Backend
- [ ] Enable compression middleware
- [ ] Use Redis for sessions (instead of Prisma store)
- [ ] Use Redis for rate limiting (for multi-instance)
- [ ] Enable database connection pooling
- [ ] Add CDN for static assets
- [ ] Monitor memory usage

### Frontend
- [ ] Enable Vercel Edge caching
- [ ] Optimize images (use WebP)
- [ ] Lazy load components (already done)
- [ ] Enable service worker for offline support
- [ ] Add loading skeletons
- [ ] Minimize bundle size

### Database
- [ ] Add indexes on frequently queried fields
- [ ] Enable query caching
- [ ] Optimize slow queries
- [ ] Regular vacuum/analyze (PostgreSQL)
- [ ] Monitor connection pool usage

---

## 📊 Monitoring

### Backend Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Monitor API response times
- [ ] Track rate limit violations
- [ ] Monitor memory/CPU usage
- [ ] Set up uptime monitoring

### Frontend Monitoring
- [ ] Vercel Analytics (already added)
- [ ] Error tracking
- [ ] Performance monitoring
- [ ] User analytics

### Database Monitoring
- [ ] Query performance
- [ ] Connection pool usage
- [ ] Storage usage
- [ ] Slow query log

---

## 🔐 Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] HTTPS enabled on all domains
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using Prisma)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection (SameSite cookies)
- [ ] Secure session cookies
- [ ] Regular dependency updates
- [ ] Security headers enabled

---

## 📝 Post-Deployment

### Immediate
- [ ] Test all critical features
- [ ] Monitor error logs for 24 hours
- [ ] Check rate limit effectiveness
- [ ] Verify CORS working for all domains
- [ ] Test on multiple browsers/devices

### Within 1 Week
- [ ] Review performance metrics
- [ ] Optimize slow endpoints
- [ ] Adjust rate limits if needed
- [ ] Fix any reported bugs
- [ ] Update documentation

### Ongoing
- [ ] Monitor uptime
- [ ] Review error logs weekly
- [ ] Update dependencies monthly
- [ ] Backup database regularly
- [ ] Review security best practices

---

## 🆘 Emergency Contacts

### Services
- **Render Support:** https://render.com/support
- **Vercel Support:** https://vercel.com/support
- **CockroachDB Support:** https://cockroachlabs.com/support
- **Groq Support:** https://console.groq.com/support

### Rollback Procedure
1. Go to Render dashboard
2. Select your service
3. Click "Manual Deploy"
4. Select previous successful deployment
5. Click "Deploy"

---

**Last Updated:** January 19, 2026
**Status:** Ready for Deployment ✅
