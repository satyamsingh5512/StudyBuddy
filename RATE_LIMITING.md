# Rate Limiting Documentation

## Overview
StudyBuddy implements comprehensive rate limiting to prevent abuse, protect resources, and ensure fair usage across all API endpoints.

## Rate Limit Tiers

### 1. Authentication Endpoints (Strict)
**Endpoints:** `/api/auth/*`
- **Limit:** 5 requests per 15 minutes
- **Purpose:** Prevent brute force attacks on login/signup
- **Key:** IP address
- **Message:** "Too many authentication attempts. Please try again in 15 minutes."

### 2. AI Endpoints (Moderate)
**Endpoints:** `/api/ai/*`
- **Limit:** 10 requests per minute
- **Purpose:** Prevent abuse of expensive AI operations
- **Key:** User ID + IP address
- **Message:** "AI request limit exceeded. Please wait a moment before trying again."

**Affected Routes:**
- `POST /api/ai/generate-tasks` - Task generation
- `POST /api/ai/study-plan` - Study plan generation
- `POST /api/ai/exam-info` - Exam information

### 3. News Endpoints (Moderate)
**Endpoints:** `/api/news/*`
- **Limit:** 20 requests per minute
- **Purpose:** Prevent excessive news API calls
- **Key:** User ID + IP address
- **Message:** "News request limit exceeded. Please try again shortly."

**Affected Routes:**
- `GET /api/news/:examType` - Get exam news
- `GET /api/news/:examType/dates` - Get important dates
- `POST /api/news/cache/clear` - Clear cache

### 4. Upload Endpoints (Strict)
**Endpoints:** `/api/upload/*`
- **Limit:** 10 uploads per hour
- **Purpose:** Prevent abuse of file upload
- **Key:** User ID + IP address
- **Message:** "Upload limit exceeded. Please try again later."

**Affected Routes:**
- `POST /api/upload/profile` - Profile picture upload
- `POST /api/upload/image` - General image upload
- `POST /api/upload/form-file` - Form file upload

### 5. Message Endpoints (Moderate)
**Endpoint:** `POST /api/messages`
- **Limit:** 30 messages per minute
- **Purpose:** Prevent spam in chat
- **Key:** User ID
- **Message:** "Message rate limit exceeded. Please slow down."

### 6. Friend Request Endpoints (Strict)
**Endpoint:** `POST /api/friends/request`
- **Limit:** 10 requests per hour
- **Purpose:** Prevent spam friend requests
- **Key:** User ID
- **Message:** "Friend request limit exceeded. Please try again later."

### 7. Report Generation (Moderate)
**Endpoint:** `POST /api/reports`
- **Limit:** 20 reports per hour
- **Purpose:** Prevent excessive report generation
- **Key:** User ID
- **Message:** "Report generation limit exceeded. Please try again later."

### 8. General API (Generous)
**Endpoints:** All other authenticated endpoints
- **Limit:** 100 requests per minute
- **Purpose:** Normal CRUD operations
- **Key:** User ID + IP address
- **Message:** "API rate limit exceeded. Please slow down."

### 9. Global Rate Limiter (Very Generous)
**Endpoints:** All endpoints
- **Limit:** 200 requests per minute
- **Purpose:** Catch-all protection
- **Key:** IP address
- **Message:** "Global rate limit exceeded. Please slow down."

## Response Headers

All rate-limited responses include these headers:

```
X-RateLimit-Limit: 100          # Maximum requests allowed
X-RateLimit-Remaining: 95       # Requests remaining in window
X-RateLimit-Reset: 1642345678   # Unix timestamp when limit resets
```

When limit is exceeded (429 status):
```
Retry-After: 60                 # Seconds until retry allowed
```

## Error Response Format

```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": 60,
  "limit": 100,
  "windowMs": 60
}
```

## Implementation Details

### Storage
- **Development:** In-memory Map (single instance)
- **Production:** Consider Redis for multi-instance deployments

### Algorithm
- Token bucket algorithm for smooth rate limiting
- Automatic cleanup of expired entries every 5 minutes
- Per-user and per-IP tracking

### Key Generation
Different endpoints use different key strategies:

```typescript
// Auth endpoints (IP-based)
`auth:${IP_ADDRESS}`

// AI endpoints (User + IP)
`ai:${USER_ID}:${IP_ADDRESS}`

// Message endpoints (User-only)
`message:${USER_ID}`

// Global (IP-only)
`${IP_ADDRESS}`
```

## Testing Rate Limits

### Using cURL

```bash
# Test auth rate limit (5 per 15 min)
for i in {1..6}; do
  curl http://localhost:3001/api/auth/me
  echo "Request $i"
done

# Test AI rate limit (10 per min)
for i in {1..11}; do
  curl -X POST http://localhost:3001/api/ai/generate-tasks \
    -H "Content-Type: application/json" \
    -d '{"prompt":"test","examGoal":"JEE"}'
  echo "Request $i"
done

# Test message rate limit (30 per min)
for i in {1..31}; do
  curl -X POST http://localhost:3001/api/messages \
    -H "Content-Type: application/json" \
    -d '{"receiverId":"user123","message":"test"}'
  echo "Request $i"
done
```

### Using JavaScript

```javascript
// Test rate limit
async function testRateLimit() {
  for (let i = 0; i < 15; i++) {
    const response = await fetch('/api/ai/generate-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', examGoal: 'JEE' })
    });
    
    console.log(`Request ${i + 1}:`, response.status);
    console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
    
    if (response.status === 429) {
      const data = await response.json();
      console.log('Rate limited! Retry after:', data.retryAfter, 'seconds');
      break;
    }
  }
}
```

## Admin Functions

### Check Rate Limit Status

```typescript
import { getRateLimitStatus } from './middleware/rateLimiting';

const status = getRateLimitStatus('user123', 'ai');
console.log(status);
// {
//   remaining: 5,
//   resetTime: 1642345678000,
//   limit: 10
// }
```

### Clear Rate Limit

```typescript
import { clearRateLimit } from './middleware/rateLimiting';

// Clear specific type
clearRateLimit('user123', 'ai');

// Clear all limits for user
clearRateLimit('user123');
```

## Production Considerations

### Redis Integration

For multi-instance deployments, replace in-memory store with Redis:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Use Redis for distributed rate limiting
const key = `ratelimit:${type}:${userId}`;
const current = await redis.incr(key);

if (current === 1) {
  await redis.expire(key, windowMs / 1000);
}

if (current > maxRequests) {
  // Rate limited
}
```

### Environment Variables

Add to `.env`:
```bash
# Rate limiting
REDIS_URL="redis://localhost:6379"
RATE_LIMIT_ENABLED="true"
```

### Monitoring

Track rate limit hits:
```typescript
// Log rate limit violations
if (record.hits > maxRequests) {
  console.warn('Rate limit exceeded:', {
    key,
    hits: record.hits,
    limit: maxRequests,
    timestamp: new Date().toISOString()
  });
}
```

## Best Practices

### For Developers

1. **Test locally** before deploying
2. **Monitor logs** for rate limit violations
3. **Adjust limits** based on usage patterns
4. **Use Redis** in production for consistency
5. **Add metrics** to track rate limit effectiveness

### For Users

1. **Respect limits** - they protect the service
2. **Check headers** to see remaining requests
3. **Implement backoff** in client code
4. **Cache responses** when possible
5. **Contact support** if limits are too restrictive

## Troubleshooting

### "Too many requests" error

**Cause:** You've exceeded the rate limit for that endpoint

**Solution:**
1. Wait for the time specified in `Retry-After` header
2. Check `X-RateLimit-Reset` to see when limit resets
3. Reduce request frequency
4. Implement exponential backoff

### Rate limits not working

**Check:**
1. Middleware is properly imported and applied
2. Routes are in correct order (specific before general)
3. User authentication is working (for user-based limits)
4. IP extraction is correct (check `getClientIP` function)

### Different limits in different environments

**Cause:** In-memory store doesn't persist across restarts

**Solution:**
1. Use Redis for persistent storage
2. Or accept that limits reset on server restart

## Security Notes

- Rate limits are per-IP and per-user to prevent circumvention
- Auth endpoints have strictest limits to prevent brute force
- Expensive operations (AI, uploads) have moderate limits
- All endpoints have a global catch-all limit
- Headers reveal limit info but not internal implementation

## Future Enhancements

- [ ] Redis integration for distributed systems
- [ ] Dynamic rate limits based on user tier
- [ ] Rate limit dashboard for admins
- [ ] Automatic IP blocking for repeated violations
- [ ] Whitelist for trusted IPs
- [ ] Per-endpoint metrics and analytics
- [ ] Configurable limits via environment variables
- [ ] Rate limit bypass for premium users

---

**Last Updated:** January 19, 2026
**Version:** 1.0.0
