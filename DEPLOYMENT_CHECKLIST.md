# Deployment Checklist - Single Unified Application

## ✅ Updated: January 24, 2026

**Deployment Model**: Single unified Node.js application (Frontend + Backend)

### ✅ **Current Status**

1. **TypeScript Compilation**: ✅ Clean (no errors)
2. **Path Aliases**: ✅ Properly configured (`@/*` → `./src/*`)
3. **Build Configuration**: ✅ Correct (Vite build)
4. **API Routes**: ✅ Properly structured
5. **Dependencies**: ✅ All installed
6. **Database**: ✅ MongoDB Atlas (Primary)
7. **Render-Specific Code**: ✅ Removed

---

## 🔧 Required Actions Before Deployment

### 1. **Environment Variables**

Set these environment variables in your hosting platform:

#### Required for All Features:
```bash
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority"
SESSION_SECRET="your-32-char-secret"  # Generate: openssl rand -base64 32
CLIENT_URL="https://your-domain.com"
NODE_ENV="production"
```

#### Required for Email Auth (OTP & Password Reset):
```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
```

**Gmail App Password Setup:**
1. Enable 2FA on your Google account
2. Go to Security → 2-Step Verification → App passwords
3. Generate password for "Mail" / "Other"
4. Use the 16-character password as `SMTP_PASS`

#### Optional (for AI features):
```bash
GROQ_API_KEY="your-groq-api-key"
CLOUDINARY_CLOUD_NAME="your-cloudinary-name"
CLOUDINARY_API_KEY="your-cloudinary-key"
CLOUDINARY_API_SECRET="your-cloudinary-secret"
```

### 2. **Build and Start Commands**

For most hosting platforms (Vercel, Railway, Render, etc.):

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm run start:server
```

**Port**: The server will use `process.env.PORT` or default to `3001`

### 3. **Update Google OAuth Settings** (If Using Google Auth)

In Google Cloud Console:
1. Go to **APIs & Services** → **Credentials**
2. Select your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   - `https://your-domain.com/api/auth/google/callback`
4. Save changes

---

## 🏗️ Architecture Overview

### Single Unified Application
- **Frontend**: Vite + React (builds to `dist/`)
- **Backend**: Express.js (serves API + static files)
- **Database**: MongoDB Atlas (single primary database)
- **Session Store**: MongoDB (connect-mongo)
- **No Separate Deployments**: One app, one deployment

### How It Works
1. Vite builds frontend to `dist/` folder
2. Express serves static files from `dist/`
3. Express handles API routes on `/api/*`
4. Single Node.js process runs everything

---

## ⚠️ Removed Components

### ✅ Render-Specific Code (Removed)
- `server/utils/keepAlive.ts` - No longer used
- `render.yaml` - Deleted
- Keep-alive service calls in `server/index.ts` - Removed

### ⚠️ Prisma (Still Present - Needs Migration)
Many routes still use Prisma instead of MongoDB:
- `server/routes/todos.ts`
- `server/routes/users.ts`
- `server/routes/friends.ts`
- `server/routes/messages.ts`
- `server/routes/reports.ts`
- `server/routes/timer.ts`
- `server/routes/schedule.ts`
- `server/routes/notices.ts`
- `server/routes/faqs.ts`
- `server/routes/news.ts`
- `server/routes/ai.ts`
- `server/routes/upload.ts`
- `server/routes/health.ts`

**Note**: Auth routes already migrated to MongoDB (see `server/routes/auth.ts`)

---

## ⚠️ Potential Issues & Solutions

### Issue 1: MongoDB Connection Errors
**Symptom**: `MongoServerSelectionError` or TLS errors

**Solution**:
- Verify `MONGODB_URI` format is correct
- Ensure IP whitelist includes `0.0.0.0/0` (or your hosting provider's IPs)
- Check username/password are URL-encoded
- Verify database name exists

### Issue 2: Email Service Failures
**Symptom**: OTP emails not sending, password reset fails

**Solution**:
- Verify SMTP credentials are correct
- Use Gmail app password (not regular password)
- Check `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587`
- Test with `node test-email.mjs` locally

### Issue 3: Session Issues
**Symptom**: Users logged out frequently, session not persisting

**Solution**:
- Verify `SESSION_SECRET` is set
- Check `MONGODB_URI` is accessible for session store
- Ensure cookies are configured correctly for your domain

### Issue 4: CORS Errors
**Symptom**: Browser blocks API requests

**Solution**:
- Update `CLIENT_URL` environment variable
- Add your domain to `allowedOrigins` in `server/index.ts`
- Or set `ALLOWED_ORIGINS` env var (comma-separated)

### Issue 5: Port Conflicts (Local Development)
**Symptom**: `EADDRINUSE` error

**Solution**:
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use the cleanup script
npm run clean
```

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Checks
```bash
# Run locally to verify
npm run build
npm run start:server

# Test the build
curl http://localhost:3001/api/health
```

### Step 2: Choose Hosting Platform

**Recommended Platforms:**
- **Vercel**: Easiest for Node.js apps
- **Railway**: Simple, good free tier
- **Render**: Good for full-stack apps
- **Fly.io**: Global edge deployment
- **DigitalOcean App Platform**: Traditional hosting

### Step 3: Configure Platform

**For Vercel:**
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set start command: `npm run start:server`
4. Add environment variables
5. Deploy

**For Railway:**
1. Connect GitHub repository
2. Add environment variables
3. Railway auto-detects build/start commands
4. Deploy

**For Render:**
1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm run start:server`
5. Add environment variables
6. Deploy

### Step 4: Post-Deployment Verification

**Test these endpoints:**
```bash
# Health check
curl https://your-domain.com/api/health

# Auth check (should return 401)
curl https://your-domain.com/api/auth/me
```

**Test in browser:**
1. Visit `https://your-domain.com`
2. Click "Get Started" → Should show Auth page
3. Try email signup → Should receive OTP
4. Verify OTP → Should log in
5. Check dashboard → Should load

---

## 📊 Build Configuration

### Current Setup

**package.json scripts:**
```json
{
  "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
  "build": "npx tsc && npx vite build",
  "start:server": "tsx server/index.ts"
}
```

**vite.config.ts:**
- ✅ Path alias resolver
- ✅ Manual chunk splitting (optimized)
- ✅ Build optimizations
- ✅ Proxy for local development

---

## 🔍 Code Quality

### ✅ Best Practices Followed

1. **Security**:
   - ✅ Bcrypt password hashing (10 rounds)
   - ✅ HttpOnly cookies
   - ✅ Session management with MongoDB
   - ✅ Input validation
   - ✅ CORS protection
   - ✅ Rate limiting middleware

2. **Performance**:
   - ✅ Code splitting
   - ✅ Lazy loading
   - ✅ Compression middleware
   - ✅ Non-blocking email sending

3. **Error Handling**:
   - ✅ Try-catch blocks
   - ✅ Error logging
   - ✅ User-friendly error messages
   - ✅ Graceful degradation

---

## 📝 Environment Variables Reference

### Production Environment
```bash
# Database (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Session (Required)
SESSION_SECRET=your-32-char-random-secret

# App Config (Required)
CLIENT_URL=https://your-domain.com
NODE_ENV=production
PORT=3001  # Optional, most platforms set this automatically

# Email (Required for OTP/Password Reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback

# AI Features (Optional)
GROQ_API_KEY=your-groq-api-key

# Image Upload (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS (Optional - for multiple domains)
ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
```

---

## 🎯 Success Criteria

After deployment, verify:

- [ ] Landing page loads
- [ ] Auth page accessible at `/auth`
- [ ] Email signup sends OTP
- [ ] OTP verification works
- [ ] Email login works
- [ ] Dashboard loads after login
- [ ] API endpoints respond (`/api/health`)
- [ ] No console errors in browser
- [ ] Sessions persist across page reloads

---

## 🆘 Troubleshooting

### If deployment fails:

1. **Check Platform Logs**:
   - Look for specific error messages
   - Check build logs and runtime logs separately

2. **Common Fixes**:
   - Verify all required env vars are set
   - Check `MONGODB_URI` format and credentials
   - Ensure SMTP credentials are correct
   - Test locally with production build

3. **Test Locally**:
   ```bash
   npm run build
   npm run start:server
   # Visit http://localhost:3001
   ```

4. **Database Issues**:
   - Test connection with `node test-mongodb-connection.mjs`
   - Verify IP whitelist in MongoDB Atlas
   - Check database name matches URI

5. **Email Issues**:
   - Test with `node test-email.mjs`
   - Check spam folder
   - Verify Gmail app password (not regular password)

---

## ✅ Final Checklist

Before marking deployment as complete:

- [ ] All environment variables set
- [ ] MongoDB connection working
- [ ] Email service configured
- [ ] `/api/health` returns 200
- [ ] Landing page loads
- [ ] Auth page works
- [ ] Email signup tested
- [ ] Dashboard accessible
- [ ] No errors in logs
- [ ] Sessions working correctly

---

## 📚 Additional Resources

- **MongoDB Setup**: See `MONGODB_SETUP.md`
- **Email OTP Setup**: See `EMAIL_OTP_SETUP_GUIDE.md`
- **Render Cleanup**: See `RENDER_CLEANUP_SUMMARY.md`
- **Project Overview**: See `PROJECT_OVERVIEW_RESUME.md`

---

**Status**: Ready for deployment ✅

**Architecture**: Single unified Node.js application

**Database**: MongoDB Atlas (primary)

**Last Updated**: January 24, 2026

**Next Steps**: 
1. Choose hosting platform
2. Set environment variables
3. Deploy and test
4. (Optional) Complete Prisma to MongoDB migration for remaining routes
