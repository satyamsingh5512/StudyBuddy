# Session Persistence Fix - Facebook/Instagram Style Login

## Problem
Users were logged out whenever they closed their browser because sessions were only stored in memory and not persisted to the database.

## Solution Implemented

### 1. **Added Persistent Session Store**
- Installed `@quixo3/prisma-session-store` to store sessions in PostgreSQL database
- Sessions now persist across browser restarts and server restarts

### 2. **Updated Database Schema**
Added new `Session` model to Prisma schema:
```prisma
model Session {
  id        String   @id
  sid       String   @unique
  data      String
  expiresAt DateTime

  @@index([expiresAt])
}
```

### 3. **Enhanced Session Configuration**
Updated `server/index.ts` with:
- **PrismaSessionStore**: Stores sessions in database instead of memory
- **30-day cookie expiry**: Like Facebook/Instagram, users stay logged in for 30 days
- **Auto cleanup**: Expired sessions are automatically removed every 2 minutes
- **Secure cookies**: httpOnly flag prevents XSS attacks
- **Cross-domain support**: Works in both development and production

### Configuration Details:
```typescript
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000, // Clean expired sessions every 2 minutes
    dbRecordIdIsSessionId: true,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true, // Prevents JavaScript access
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
})
```

## How It Works Now

1. **Login**: User logs in with Google OAuth
2. **Session Created**: Session is saved to PostgreSQL with 30-day expiry
3. **Cookie Set**: Browser receives cookie with 30-day maxAge
4. **Close Browser**: Cookie persists in browser storage
5. **Reopen Browser**: Cookie is sent with requests
6. **Auto Login**: Server finds session in database and authenticates user

## Benefits

✅ **Persistent Login**: Users stay logged in for 30 days like Facebook/Instagram
✅ **Survives Browser Restart**: Sessions persist across browser closes
✅ **Survives Server Restart**: Sessions stored in database, not memory
✅ **Auto Cleanup**: Old sessions are automatically cleaned up
✅ **Secure**: httpOnly and sameSite flags protect against attacks
✅ **Production Ready**: Works seamlessly in both dev and production

## User Experience

- **First Login**: User logs in with Google OAuth
- **Return Visits**: Automatically logged in for 30 days
- **Manual Logout**: User can still manually log out anytime
- **Expired Session**: After 30 days, user needs to login again

## Technical Stack

- **Session Store**: `@quixo3/prisma-session-store`
- **Database**: PostgreSQL (via Prisma ORM)
- **Backend**: Express.js with express-session
- **Authentication**: Passport.js with Google OAuth

## Testing

To test the fix:
1. Login to the application
2. Close the browser completely
3. Reopen the browser
4. Navigate to the app URL
5. ✅ You should still be logged in!

## Notes

- Sessions expire after 30 days of inactivity
- Users can manually logout at any time
- The session store automatically cleans expired sessions
- Sessions survive server restarts and deployments
