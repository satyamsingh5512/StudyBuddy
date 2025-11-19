# Backend Deployment Guide (Render)

## Why Separate Backend?
Your app uses:
- WebSockets (Socket.io) for real-time chat
- Long-running connections
- Session management

These require a persistent server, not serverless functions.

## Deploy Backend to Render (Free)

### 1. Create Render Account
1. Go to https://render.com/
2. Sign up with GitHub

### 2. Create Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `studybuddy-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `node dist-server/index.js`
   - **Instance Type**: Free

### 3. Add Environment Variables
Add these in Render dashboard:
```
DATABASE_URL=your_neon_database_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://studybuddy-backend.onrender.com/api/auth/google/callback
SESSION_SECRET=your_session_secret
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=production
CLIENT_URL=https://study-buddy-beta-one.vercel.app
PORT=3001
```

### 4. Update Google OAuth
Add to **Authorized redirect URIs**:
```
https://studybuddy-backend.onrender.com/api/auth/google/callback
```

Add to **Authorized JavaScript origins**:
```
https://studybuddy-backend.onrender.com
```

### 5. Update Frontend (Vercel)
Add environment variable in Vercel:
```
VITE_API_URL=https://studybuddy-backend.onrender.com
```

### 6. Update Frontend Code
We need to update API calls to use the backend URL.

## Alternative: Railway

Railway is another good option:
1. Go to https://railway.app/
2. Connect GitHub repo
3. Add environment variables
4. Deploy automatically

## Alternative: Fly.io

For more control:
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly launch`
3. Configure and deploy

## Note on Free Tiers
- **Render Free**: Spins down after 15 min inactivity (cold starts)
- **Railway**: $5 free credit/month
- **Fly.io**: 3 free VMs

For production, consider upgrading to paid tier for better performance.
