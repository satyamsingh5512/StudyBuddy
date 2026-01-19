# CORS Configuration Guide

## Overview
StudyBuddy uses CORS (Cross-Origin Resource Sharing) to control which domains can access the API. This is essential for security when your frontend and backend are on different domains.

## Current Configuration

### Allowed Origins (Hardcoded)
The following origins are allowed by default:
- `http://localhost:5173` - Local development (Vite)
- `http://localhost:5174` - Alternative local port
- `https://sbd.satym.site` - Production frontend
- `https://studybuddyone.vercel.app` - Vercel deployment

### Environment Variables
You can add additional origins via environment variables:

```bash
# Single origin
CLIENT_URL="https://yourdomain.com"

# Multiple origins (comma-separated)
ALLOWED_ORIGINS="https://app.yourdomain.com,https://staging.yourdomain.com"
```

## Common CORS Errors

### Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** Your frontend domain is not in the allowed origins list.

**Solution:**
1. Add your domain to `server/index.ts`:
```typescript
const allowedOrigins = [
  // ... existing origins
  'https://your-domain.com',
];
```

2. Or use environment variable:
```bash
ALLOWED_ORIGINS="https://your-domain.com"
```

3. Restart the server

### Error: "CORS policy: credentials mode"

**Cause:** Credentials (cookies) are being sent but CORS is not configured for it.

**Solution:** Already configured in the code:
```typescript
cors({
  origin: allowedOrigins,
  credentials: true, // ✅ Already set
})
```

### Error: "Preflight request failed"

**Cause:** Browser sends OPTIONS request before actual request, and server doesn't handle it.

**Solution:** Already handled by `cors` middleware automatically.

## Testing CORS

### Using cURL
```bash
# Test from allowed origin
curl -H "Origin: https://sbd.satym.site" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://studybuddy-backend-5ayj.onrender.com/api/health

# Should return:
# Access-Control-Allow-Origin: https://sbd.satym.site
# Access-Control-Allow-Credentials: true
```

### Using Browser Console
```javascript
fetch('https://studybuddy-backend-5ayj.onrender.com/api/health', {
  credentials: 'include'
})
  .then(res => res.json())
  .then(data => console.log('✅ CORS working:', data))
  .catch(err => console.error('❌ CORS error:', err));
```

### Using Postman
1. Disable "Send cookies" in Postman settings
2. Add header: `Origin: https://sbd.satym.site`
3. Send request to `/api/health`
4. Check response headers for `Access-Control-Allow-Origin`

## Production Deployment

### Render.com (Backend)
1. Go to your Render dashboard
2. Select your service
3. Go to "Environment" tab
4. Add environment variables:
```
CLIENT_URL=https://sbd.satym.site
ALLOWED_ORIGINS=https://sbd.satym.site,https://yourdomain.com
```
5. Save and redeploy

### Vercel (Frontend)
No CORS configuration needed on frontend. Just ensure:
1. API_URL points to correct backend
2. Credentials are included in fetch requests

## Security Best Practices

### ✅ DO
- Explicitly list allowed origins
- Use environment variables for flexibility
- Enable credentials only when needed
- Use HTTPS in production
- Validate origin on server side

### ❌ DON'T
- Use `origin: '*'` with credentials
- Allow all origins in production
- Trust client-side origin headers
- Disable CORS in production
- Hardcode production URLs in code

## Advanced Configuration

### Allow Subdomains
```typescript
const allowedOrigins = [
  /^https:\/\/.*\.yourdomain\.com$/,
  'https://yourdomain.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    callback(isAllowed ? null : new Error('Not allowed'), isAllowed);
  },
  credentials: true,
}));
```

### Dynamic Origin Validation
```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in development
    if (isDevelopment) {
      return callback(null, true);
    }
    
    // Strict checking in production
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### Custom Headers
```typescript
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  maxAge: 86400, // 24 hours
}));
```

## Troubleshooting Checklist

- [ ] Is your domain in the allowed origins list?
- [ ] Did you restart the server after changes?
- [ ] Are you using HTTPS in production?
- [ ] Is `credentials: true` set in both frontend and backend?
- [ ] Are cookies being sent with requests?
- [ ] Is the backend URL correct in frontend config?
- [ ] Are there any proxy/CDN issues?
- [ ] Check browser console for specific error messages
- [ ] Test with cURL to isolate frontend issues

## Health Check Endpoints

The server provides multiple health check endpoints:

```bash
# Public health check (no auth required)
GET /health
GET /api/health

# Detailed health check (auth required)
GET /api/health/detailed
```

All health endpoints support CORS and can be used to verify server status.

## Environment Setup

### Development (.env)
```bash
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"
```

### Production (Render)
```bash
CLIENT_URL="https://sbd.satym.site"
ALLOWED_ORIGINS="https://sbd.satym.site"
NODE_ENV="production"
```

## Support

If you're still experiencing CORS issues:

1. Check server logs for CORS errors
2. Verify environment variables are set correctly
3. Test with cURL to isolate the issue
4. Check if your domain is being blocked by firewall/CDN
5. Ensure SSL certificates are valid

---

**Last Updated:** January 19, 2026
**Version:** 1.0.0
