# Authentication Setup Guide

Complete industrial-grade authentication system with email/password + OTP verification and Google OAuth.

## Features

✅ **Email/Password Authentication**
- Secure password hashing with bcrypt (12 rounds)
- Email verification via 6-digit OTP
- OTP expiration (10 minutes)
- Resend OTP functionality

✅ **Password Reset**
- Secure token-based password reset
- Email notifications with reset links
- Token expiration (1 hour)
- One-time use tokens

✅ **Google OAuth**
- Single Sign-On with Google
- Account linking (if email already exists)
- Automatic email verification

✅ **Security Features**
- JWT-based stateless authentication
- HttpOnly cookies
- CORS protection
- Password strength validation (min 8 characters)
- Email enumeration prevention
- Rate limiting ready

✅ **User Experience**
- Modern, animated UI with Framer Motion
- Real-time form validation
- Loading states and error handling
- Toast notifications
- Mobile-responsive design

## Environment Variables

Add these to your Vercel project settings:

### Required for Email Auth

```bash
# SMTP Configuration (Gmail example)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-specific-password"
```

### Gmail Setup (Recommended)

1. Go to Google Account Settings
2. Enable 2-Factor Authentication
3. Generate App Password:
   - Go to Security → 2-Step Verification → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
   - Use this as `SMTP_PASS`

### Alternative SMTP Providers

**SendGrid:**
```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

**Mailgun:**
```bash
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASS="your-mailgun-password"
```

**AWS SES:**
```bash
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_USER="your-ses-smtp-username"
SMTP_PASS="your-ses-smtp-password"
```

### Already Required

```bash
DATABASE_URL="your-cockroachdb-connection-string"
JWT_SECRET="your-jwt-secret-min-32-chars"
CLIENT_URL="https://sbd.satym.site"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="https://sbd.satym.site/api/auth/google/callback"
```

## Database Migration

Run this to update your database schema:

```bash
npx prisma db push
```

This adds:
- `password` field to User model (optional, for email/password auth)
- `emailVerified` field to User model
- `EmailVerification` table for OTP storage
- `PasswordReset` table for reset tokens
- Makes `googleId` optional (was required before)

## API Endpoints

### Email/Password Auth

**POST /api/auth/signup**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**POST /api/auth/verify-otp**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**POST /api/auth/resend-otp**
```json
{
  "email": "user@example.com"
}
```

**POST /api/auth/login**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**POST /api/auth/forgot-password**
```json
{
  "email": "user@example.com"
}
```

**POST /api/auth/reset-password**
```json
{
  "token": "reset-token-from-email",
  "password": "newsecurepassword123"
}
```

### Google OAuth

**GET /api/auth/google**
- Redirects to Google OAuth consent screen

**GET /api/auth/google/callback**
- Handles OAuth callback
- Creates or links account
- Sets auth cookie
- Redirects to dashboard

### Session Management

**GET /api/auth/me**
- Returns current user or 401

**POST /api/auth/logout**
- Clears auth cookie

## Frontend Routes

- `/` - Landing page (redirects to dashboard if authenticated)
- `/auth` - Login/Signup page (not created yet, uses Landing)
- `/reset-password?token=xxx` - Password reset page
- `/dashboard` - Main dashboard (requires auth)

## UI Components

### Auth Page (`src/pages/Auth.tsx`)

Multi-mode authentication page with:
- Login form
- Signup form
- OTP verification
- Forgot password
- Google OAuth button
- Smooth transitions between modes

### Reset Password Page (`src/pages/ResetPassword.tsx`)

Dedicated password reset page with:
- Token validation
- Password confirmation
- Strength requirements
- Auto-redirect after success

## Email Templates

Professional HTML email templates included:

1. **OTP Verification Email**
   - 6-digit code display
   - 10-minute expiration notice
   - Branded design

2. **Password Reset Email**
   - Secure reset link button
   - 1-hour expiration notice
   - Fallback URL for email clients

3. **Welcome Email**
   - Sent after successful verification
   - Getting started tips
   - Call-to-action button

## Security Best Practices

✅ **Implemented:**
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 30-day expiration
- HttpOnly cookies (prevents XSS)
- Secure cookies in production (HTTPS only)
- SameSite cookie policy
- Email enumeration prevention (forgot password)
- One-time use reset tokens
- Token expiration
- Input validation and sanitization

🔧 **Recommended Additions:**
- Rate limiting (use Vercel's built-in or Upstash Redis)
- CAPTCHA for signup/login (Google reCAPTCHA)
- Account lockout after failed attempts
- Email change verification
- 2FA/TOTP support
- Session management (view/revoke active sessions)
- Audit logging

## Testing

### Test Email Auth Flow

1. **Signup:**
   ```bash
   curl -X POST https://sbd.satym.site/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test1234","name":"Test User"}'
   ```

2. **Check email for OTP**

3. **Verify OTP:**
   ```bash
   curl -X POST https://sbd.satym.site/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","otp":"123456"}'
   ```

4. **Login:**
   ```bash
   curl -X POST https://sbd.satym.site/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test1234"}'
   ```

### Test Google OAuth

1. Visit: `https://sbd.satym.site/api/auth/google`
2. Complete Google sign-in
3. Should redirect to dashboard

## Troubleshooting

### Email Not Sending

1. Check SMTP credentials in Vercel environment variables
2. Verify SMTP_USER and SMTP_PASS are correct
3. For Gmail, ensure App Password is used (not regular password)
4. Check Vercel function logs for email errors

### OTP Not Working

1. Check OTP hasn't expired (10 minutes)
2. Verify email matches exactly
3. Try resending OTP
4. Check database for EmailVerification records

### Google OAuth Failing

1. Verify GOOGLE_CALLBACK_URL matches Google Console
2. Check CLIENT_URL is set correctly (no trailing slash)
3. Ensure Google OAuth consent screen is configured
4. Verify authorized redirect URIs in Google Console

### Password Reset Not Working

1. Check email was sent (check spam folder)
2. Verify token hasn't expired (1 hour)
3. Ensure token hasn't been used already
4. Check PasswordReset table in database

## Performance Optimizations

Following Vercel React Best Practices:

✅ **Implemented:**
- `useTransition` for mode switching (non-blocking UI updates)
- Lazy loading of Auth page
- Parallel API calls (Promise.all for OTP + email)
- Early returns in validation
- Functional setState for loading states
- Memoized form handlers

## Next Steps

1. **Deploy to Vercel:**
   ```bash
   git add -A
   git commit -m "Add industrial-grade auth system"
   git push
   ```

2. **Set Environment Variables in Vercel Dashboard**

3. **Run Database Migration:**
   - Vercel will run `npx prisma generate` automatically
   - You may need to run `npx prisma db push` manually once

4. **Test All Flows:**
   - Email signup → OTP → Login
   - Google OAuth
   - Password reset
   - Account linking (signup with email, then login with Google)

5. **Optional Enhancements:**
   - Add rate limiting
   - Implement CAPTCHA
   - Add 2FA support
   - Create admin panel for user management

## Support

For issues or questions:
1. Check Vercel function logs
2. Verify environment variables
3. Test SMTP connection separately
4. Review database records (Prisma Studio)

---

**Built with:** React, TypeScript, Prisma, Nodemailer, bcrypt, jose (JWT), Framer Motion
