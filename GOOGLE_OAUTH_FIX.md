# Google OAuth Fix ✅

## Issue
Google OAuth was returning error:
```json
{"error":"Google OAuth is not configured. Please contact the administrator."}
```

## Root Cause
The `tsx` command was not loading the `.env` file, so environment variables (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`) were undefined when the passport configuration loaded.

## Solution
Added `--env-file=.env` flag to tsx commands in `package.json`:

### Before:
```json
"dev:server": "tsx watch server/index.ts",
"start:server": "tsx server/index.ts"
```

### After:
```json
"dev:server": "tsx watch --env-file=.env server/index.ts",
"start:server": "tsx --env-file=.env server/index.ts"
```

## Files Modified
1. `package.json` - Added `--env-file=.env` to tsx commands
2. `server/index.ts` - Moved `dotenv.config()` to the very top

## Testing
✅ Google OAuth now works:
```bash
curl -I http://localhost:3001/api/auth/google
# Returns: HTTP/1.1 302 Found (redirect to Google)
```

## Usage
1. **Start the server:**
   ```bash
   npm run dev:server
   ```

2. **Access Google OAuth:**
   - Frontend: Click "Sign in with Google"
   - Direct: `http://localhost:3001/api/auth/google`

3. **Verify it's working:**
   - Should redirect to Google login page
   - After login, redirects back to your app

## Environment Variables Required
Make sure these are set in `.env`:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
CLIENT_URL=http://localhost:5173
```

## Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click your OAuth 2.0 Client ID
5. Add these URLs:

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:3001
```

**Authorized redirect URIs:**
```
http://localhost:3001/api/auth/google/callback
```

## Status
✅ **FIXED** - Google OAuth is now fully functional!

Date: January 25, 2026
