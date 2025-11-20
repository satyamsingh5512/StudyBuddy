# Keep Render Server Alive

This document explains how to prevent your Render free tier server from spinning down due to inactivity.

## Problem
Render's free tier spins down services after 15 minutes of inactivity. This causes:
- Slow initial response times (cold starts)
- Session interruptions
- Poor user experience

## Solutions Implemented

### 1. Internal Keep-Alive Service ✅
The server now includes an automated keep-alive service that pings itself every 14 minutes.

**How it works:**
- Automatically starts in production on Render
- Pings `/api/health` endpoint every 14 minutes
- Logs ping activity for monitoring
- Gracefully stops during shutdown

**Configuration:**
```typescript
// server/utils/keepAlive.ts
PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (before 15-minute timeout)
```

### 2. External Cron Jobs (Recommended)
For maximum reliability, set up external cron jobs to ping your server:

#### Option A: Cron-Job.org (Easiest)
1. Visit [cron-job.org](https://cron-job.org)
2. Create a free account
3. Add a new cron job:
   - URL: `https://your-app.onrender.com/api/health`
   - Interval: Every 14 minutes
   - Method: GET

#### Option B: UptimeRobot (Free 50 monitors)
1. Visit [uptimerobot.com](https://uptimerobot.com)
2. Create a free account
3. Add new monitor:
   - Monitor Type: HTTP(s)
   - URL: `https://your-app.onrender.com/api/health`
   - Monitoring Interval: 5 minutes (free tier)

#### Option C: Render Cron Job (If available)
Add to `render.yaml`:
```yaml
services:
  - type: cron
    name: studybuddy-keepalive
    env: node
    schedule: "*/14 * * * *"  # Every 14 minutes
    buildCommand: echo "Cron job setup"
    startCommand: curl https://your-app.onrender.com/api/health
```

#### Option D: GitHub Actions (Free)
Create `.github/workflows/keepalive.yml`:
```yaml
name: Keep Server Alive

on:
  schedule:
    - cron: '*/14 * * * *'  # Every 14 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Server
        run: curl -f https://your-app.onrender.com/api/health || exit 0
```

### 3. Resource Optimization

#### Connection Pooling
Prisma connection pooling is configured for efficient database usage:
```typescript
// Automatically managed by Prisma
// Connection pool size adjusts based on available resources
```

#### Session Store Optimization
```typescript
// server/index.ts
checkPeriod: 2 * 60 * 1000, // Clean expired sessions every 2 minutes
```

#### Memory Management
- Sessions stored in database (not memory)
- Automatic cleanup of expired sessions
- Efficient query caching

## Environment Variables Required

Add to your Render dashboard:
```
RENDER_EXTERNAL_URL=https://your-app.onrender.com
```

## Monitoring

Check keep-alive logs in Render dashboard:
```
✅ Keep-alive ping #1 successful at 2025-11-21T10:00:00.000Z
✅ Keep-alive ping #2 successful at 2025-11-21T10:14:00.000Z
```

## Best Practices

1. **Use Multiple Methods**: Combine internal keep-alive + external cron job
2. **Monitor Logs**: Check Render logs regularly for ping success
3. **Set Alerts**: Use UptimeRobot or similar for downtime alerts
4. **Optimize Queries**: Use Prisma query optimization
5. **Cache Responses**: Implement caching for frequently accessed data

## Cost Considerations

### Free Tier Limits
- 750 hours/month (enough for 24/7 uptime)
- Keep-alive pings are lightweight (minimal resource usage)
- Each ping takes <100ms

### Upgrade Benefits (Paid Plans)
- No automatic spin-down
- Dedicated resources
- Better performance
- More control over scaling

## Troubleshooting

### Server still spinning down?
1. Check Render logs for keep-alive pings
2. Verify `RENDER_EXTERNAL_URL` is set correctly
3. Ensure external cron job is configured
4. Check Render dashboard for service status

### High resource usage?
1. Review database query efficiency
2. Check for memory leaks
3. Optimize session cleanup frequency
4. Consider upgrading Render plan

## Additional Tips

1. **Health Check Endpoint**: Already configured at `/api/health`
2. **Connection Persistence**: WebSocket connections help keep server alive
3. **Database Connection**: Prisma maintains efficient connection pooling
4. **Session Persistence**: 30-day sessions reduce authentication overhead

## Support

For issues:
1. Check Render logs: `View Logs` in Render dashboard
2. Review keep-alive statistics in server logs
3. Test health endpoint: `curl https://your-app.onrender.com/api/health`

---

**Status**: ✅ Keep-alive service is active and configured
**Last Updated**: November 21, 2025
