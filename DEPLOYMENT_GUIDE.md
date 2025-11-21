# StudyBuddy Deployment Guide

## Architecture

- **Frontend**: Vercel (https://studybuddyone.vercel.app)
- **Backend**: Render (Express API server)
- **Database**: Neon (PostgreSQL)

## 🚀 Step 1: Deploy Backend to Render

1. **Go to Render Dashboard**: https://dashboard.render.com/

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select repository: `satyamsingh5512/StudyBuddy`
   - Click "Connect"

3. **Configure Service**:
   - **Name**: `studybuddy-api` (or any name you prefer)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate && npm run build:server`
   - **Start Command**: `node dist-server/index.js`
   - **Instance Type**: Free

4. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=your_neon_database_url_here
   SESSION_SECRET=generate_random_string_here
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=https://YOUR_RENDER_URL.onrender.com/api/auth/google/callback
   CLIENT_URL=https://studybuddyone.vercel.app
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

5. **Click "Create Web Service"**

6. **Wait for deployment** (5-10 minutes)

7. **Copy your Render URL**: `https://studybuddy-XXXXX.onrender.com`

---

## 🔧 Step 2: Update Frontend Configuration

1. **Update `src/config/api.ts`** with your Render URL:
   ```typescript
   export const API_URL =
     (import.meta as any).env?.VITE_API_URL || 
     (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
       ? 'https://studybuddy-XXXXX.onrender.com' // YOUR RENDER URL
       : 'http://localhost:3001');
   ```

2. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "chore: update API URL for production"
   git push origin main
   ```

3. **Vercel will automatically redeploy**

---

## 🔐 Step 3: Configure Google OAuth

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Navigate to**: APIs & Services → Credentials

3. **Edit your OAuth 2.0 Client**

4. **Add Authorized JavaScript Origins**:
   - `https://studybuddyone.vercel.app`
   - `https://studybuddy-XXXXX.onrender.com`
   - `http://localhost:5173` (for local development)

5. **Add Authorized Redirect URIs**:
   - `https://studybuddy-XXXXX.onrender.com/api/auth/google/callback`
   - `http://localhost:3001/api/auth/google/callback` (for local development)

6. **Click Save**

---

## 🗄️ Step 4: Verify Database Connection

1. **Your Neon Database URL** should be in this format:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/studybuddy?sslmode=require
   ```

2. **Make sure you've run migrations**:
   - Render will run `npx prisma generate` automatically
   - If you need to run migrations: add to build command:
     ```
     npm install && npx prisma generate && npx prisma migrate deploy && npm run build:server
     ```

---

## ✅ Step 5: Test Everything

1. **Visit your Vercel URL**: https://studybuddyone.vercel.app

2. **Click "Sign in with Google"**

3. **Verify**:
   - ✅ OAuth flow works
   - ✅ User data is saved to database
   - ✅ Sessions work across page reloads
   - ✅ All API calls work

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch" or CORS errors

**Solution**: Update `CLIENT_URL` on Render:
```
CLIENT_URL=https://studybuddyone.vercel.app
```

### Issue: "Google OAuth not configured"

**Solution**: Check Render environment variables:
- `GOOGLE_CLIENT_ID` is set correctly
- `GOOGLE_CLIENT_SECRET` is set correctly
- `GOOGLE_CALLBACK_URL` matches Render URL

### Issue: Database connection errors

**Solution**: 
- Copy Neon connection string from Neon dashboard
- Make sure it includes `?sslmode=require`
- Update `DATABASE_URL` on Render

### Issue: Session not persisting

**Solution**:
- Generate strong `SESSION_SECRET`: `openssl rand -base64 32`
- Update on Render
- Make sure `trust proxy` is set to 1 in `server/index.ts` (already configured)

---

## 📝 Environment Variables Summary

### Render (Backend)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
SESSION_SECRET=random-secret-string
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://YOUR_RENDER_URL.onrender.com/api/auth/google/callback
CLIENT_URL=https://studybuddyone.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Vercel (Frontend)
```
VITE_API_URL=https://YOUR_RENDER_URL.onrender.com
```

---

## 🎉 Your App is Live!

- **Frontend**: https://studybuddyone.vercel.app
- **Backend**: https://YOUR_RENDER_URL.onrender.com
- **Database**: Neon PostgreSQL

---

## 💡 Optional: Custom Domain

### For Render:
1. Go to Settings → Custom Domain
2. Add your domain (e.g., `api.studybuddy.com`)
3. Update DNS records

### For Vercel:
1. Go to Settings → Domains
2. Add your domain (e.g., `studybuddy.com`)
3. Update DNS records

---

## 🔄 Future Deployments

**Backend changes**:
- Push to GitHub → Render auto-deploys

**Frontend changes**:
- Push to GitHub → Vercel auto-deploys

**Database changes**:
- Run migrations locally: `npx prisma migrate dev`
- Push to GitHub
- Render will run `prisma migrate deploy` automatically

---

## 📊 Monitoring

- **Render Logs**: Check for backend errors
- **Vercel Logs**: Check for frontend build issues
- **Neon Dashboard**: Monitor database usage

---

Need help? Check:
- Render Status: https://render.com/status
- Vercel Status: https://vercel-status.com
- Neon Status: https://neon.tech/status
