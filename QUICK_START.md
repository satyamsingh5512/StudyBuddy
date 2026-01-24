# Quick Start Guide

## ✅ Everything is Working!

Your StudyBuddy app is now fully configured and ready to use.

## Running the Application

### Start Both Servers

**Terminal 1 - Backend:**
```bash
npm run dev:server
```
Wait for:
```
✅ MongoDB connected
✅ Server running on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev:client
```
Wait for:
```
VITE ready in XXXms
Local: http://localhost:5173/
```

### Or Start Both Together
```bash
npm run dev
```

## Testing Signup

1. Open browser: `http://localhost:5173/auth`
2. Click "Sign up"
3. Fill in the form:
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
4. Click "Create Account"
5. **Check Terminal 1** for OTP code:
   ```
   📧 OTP for john@example.com: 123456
   ```
6. Enter the OTP code
7. You're logged in! 🎉

## Important Notes

### OTP Codes
- OTP codes are displayed in the **backend terminal** (Terminal 1)
- Look for: `📧 OTP for email@example.com: XXXXXX`
- Codes expire in 10 minutes

### Email Service
- Currently not configured (optional)
- OTP codes shown in terminal for development
- To enable emails, configure SMTP in `.env`

## Troubleshooting

### "404 Not Found" Error
✅ **Fixed!** - API_URL now uses Vite proxy

### "MongoDB connection failed"
✅ **Fixed!** - MongoDB credentials updated

### "Failed to create account"
- Check if email already exists
- Check backend terminal for error details

### Can't see OTP code
- Look in **Terminal 1** (backend server)
- Search for `📧 OTP for`

## Configuration Files

### `.env` - Environment Variables
```env
MONGODB_URI=mongodb+srv://...  # ✅ Configured
CLIENT_URL=http://localhost:5173  # ✅ Configured
PORT=3001  # ✅ Configured
```

### `src/config/api.ts` - API Configuration
```typescript
export const API_URL = '/api';  // ✅ Uses Vite proxy
```

### `vite.config.ts` - Proxy Configuration
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',  // ✅ Configured
    changeOrigin: true,
  },
}
```

## Available Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-otp` - Verify email
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/forgot-password` - Reset password
- `POST /api/auth/reset-password` - Set new password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Health Check
- `GET /api/health` - Server status

## What's Working

✅ MongoDB database connection
✅ User signup with email/password
✅ Password hashing (bcrypt)
✅ OTP generation and verification
✅ Email verification requirement
✅ Login with credentials
✅ Session management
✅ Frontend-backend communication
✅ Vite proxy configuration

## What's Next

### Optional Enhancements
1. Configure email service (SMTP)
2. Set up Google OAuth
3. Migrate remaining routes to MongoDB
4. Deploy to production

## Support

If you encounter any issues:
1. Check both terminal windows for errors
2. Verify MongoDB connection in logs
3. Ensure both servers are running
4. Check browser console for frontend errors

## Quick Commands

```bash
# Start everything
npm run dev

# Start backend only
npm run dev:server

# Start frontend only
npm run dev:client

# Check MongoDB connection
curl http://localhost:3001/api/health

# Test signup
curl -X POST http://localhost:5173/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123","name":"Test"}'
```

---

**You're all set!** 🚀 Open `http://localhost:5173` and start using your app!
