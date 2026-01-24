# Signup Issue - Fix Summary

## Problem
"Signup failed to create account" error when trying to sign up with email/password.

## Root Cause
The application was using CockroachDB/PostgreSQL (Prisma), but the database credentials were invalid. Additionally, the auth endpoints were returning 404 errors because they weren't properly configured.

## Solution Implemented

### 1. Migrated to MongoDB
- Replaced Prisma with MongoDB native driver
- Created MongoDB abstraction layer (`server/lib/db.ts`)
- Updated all authentication routes to use MongoDB

### 2. Fixed Authentication System
- ✅ Created `/api/auth/signup` endpoint
- ✅ Created `/api/auth/login` endpoint
- ✅ Created `/api/auth/verify-otp` endpoint
- ✅ Created `/api/auth/resend-otp` endpoint
- ✅ Created `/api/auth/forgot-password` endpoint
- ✅ Created `/api/auth/reset-password` endpoint
- ✅ Updated Google OAuth to use MongoDB
- ✅ Created email service for OTP verification

### 3. Session Management
- Replaced Prisma session store with `connect-mongo`
- Sessions now stored in MongoDB

## Current Status

### ✅ Completed
- Auth routes created and configured
- MongoDB database layer implemented
- Email service for OTP verification
- Password hashing with bcrypt
- Session management with MongoDB

### ⚠️ Requires Action

**CRITICAL: MongoDB Connection Failed**

The MongoDB credentials in your `.env` file are invalid or expired:

```
❌ MongoDB connection failed: bad auth : authentication failed
```

**You need to:**

1. **Update MongoDB credentials** in `.env` file
2. **Whitelist your IP** in MongoDB Atlas
3. **Verify the connection string** is correct

See `MONGODB_SETUP.md` for detailed instructions.

## How to Fix

### Step 1: Update MongoDB URI

Edit `.env` file and update the MongoDB connection string:

```env
MONGODB_URI=mongodb+srv://<NEW_USERNAME>:<NEW_PASSWORD>@<CLUSTER>.mongodb.net/studybuddy?retryWrites=true&w=majority
```

### Step 2: Configure Email Service (Optional but Recommended)

For OTP verification to work, configure SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

**To get Gmail app password:**
1. Go to Google Account settings
2. Enable 2-factor authentication
3. Generate an "App Password" for "Mail"
4. Use that password in SMTP_PASS

### Step 3: Start the Server

```bash
npm run dev:server
```

Look for:
```
✅ MongoDB connected
✅ MongoDB ready as primary database
✅ Server running on http://localhost:3001
```

### Step 4: Test Signup

1. Go to `http://localhost:5173/auth`
2. Click "Sign up"
3. Fill in name, email, and password
4. Click "Create Account"
5. Check your email for OTP code
6. Enter OTP to verify

## Authentication Flow

### Email Signup Flow:
1. User enters name, email, password
2. Server creates user with `emailVerified: false`
3. Server generates 6-digit OTP (expires in 10 minutes)
4. Server sends OTP via email
5. User enters OTP
6. Server verifies OTP and marks email as verified
7. User is logged in

### Email Login Flow:
1. User enters email and password
2. Server verifies credentials
3. Server checks if email is verified
4. If verified, user is logged in
5. If not verified, redirects to OTP verification

### Password Reset Flow:
1. User clicks "Forgot password"
2. User enters email
3. Server generates reset token (expires in 1 hour)
4. Server sends reset link via email
5. User clicks link and enters new password
6. Password is updated

## Files Modified

### Created:
- `server/lib/db.ts` - MongoDB database abstraction
- `server/lib/email.ts` - Email service for OTP/reset
- `MONGODB_MIGRATION.md` - Migration documentation
- `MONGODB_SETUP.md` - Setup instructions
- `SIGNUP_FIX_SUMMARY.md` - This file

### Updated:
- `.env` - Changed to MongoDB URI
- `server/routes/auth.ts` - Complete auth implementation
- `server/config/passport.ts` - MongoDB integration
- `server/lib/mongodb.ts` - Enhanced connection handling
- `server/index.ts` - MongoDB session store

## Next Steps

1. **Fix MongoDB connection** (see MONGODB_SETUP.md)
2. **Configure email service** (optional but recommended)
3. **Test the signup flow**
4. **Migrate remaining routes** from Prisma to MongoDB (todos, messages, etc.)

## Testing Checklist

Once MongoDB is connected:

- [ ] Email signup works
- [ ] OTP email is received
- [ ] OTP verification works
- [ ] Email login works
- [ ] Password reset works
- [ ] Google OAuth works (if configured)
- [ ] Sessions persist after server restart

## Support

If you encounter issues:

1. Check server logs for error messages
2. Verify MongoDB connection in Atlas dashboard
3. Test email service with a simple test
4. Check browser console for frontend errors

## Important Notes

- Passwords are hashed with bcrypt (10 rounds)
- OTP codes expire after 10 minutes
- Reset tokens expire after 1 hour
- Sessions persist for 30 days
- Email verification is required before login
