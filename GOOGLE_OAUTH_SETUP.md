# Google OAuth Setup for studybuddyone.vercel.app

## Your URLs

**Frontend**: `https://studybuddyone.vercel.app`
**Backend**: You need to deploy this separately (see below)

## Google Cloud Console Setup

### 1. Go to Google Cloud Console
https://console.cloud.google.com/

### 2. Select Your Project
Click on the project dropdown and select your StudyBuddy project

### 3. Go to Credentials
- Click **APIs & Services** → **Credentials**
- Click on your OAuth 2.0 Client ID

### 4. Add Authorized JavaScript Origins

Add these URLs:
```
https://studybuddyone.vercel.app
http://localhost:5173
```

### 5. Add Authorized Redirect URIs

**Important**: The redirect URI depends on where your BACKEND is hosted, not frontend!

#### If backend on Render:
```
https://studybuddy-backend.onrender.com/api/auth/google/callback
http://localhost:3001/api/auth/google/callback
```

#### If backend on Railway:
```
https://studybuddy-backend.up.railway.app/api/auth/google/callback
http://localhost:3001/api/auth/google/callback
```

### 6. Click Save

## Environment Variables

### Backend (Render/Railway)
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://your-backend-url.com/api/auth/google/callback
CLIENT_URL=https://studybuddyone.vercel.app
```

### Frontend (Vercel)
```
VITE_API_URL=https://your-backend-url.com
```

## Testing

1. Go to `https://studybuddyone.vercel.app`
2. Click "Sign in with Google"
3. Should redirect to Google
4. After login, redirects back to your app

## Common Issues

### "redirect_uri_mismatch" error
- Check that `GOOGLE_CALLBACK_URL` in backend matches exactly what's in Google Console
- No trailing slashes
- Must be HTTPS in production

### "Failed to fetch" error
- Backend is not deployed or not running
- Check `VITE_API_URL` in Vercel environment variables
- Check backend logs

### Infinite loading
- Backend URL is wrong
- CORS not configured properly
- Check browser console for errors
