# Render Deployment Setup Guide

## 🚀 Quick Setup

### 1. Set Environment Variables in Render Dashboard

Go to your Render service dashboard and add these environment variables:

```
# Required
DATABASE_URL=your-postgresql-connection-string
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback
SESSION_SECRET=your-random-secret-key
GEMINI_API_KEY=your-gemini-api-key
CLIENT_URL=https://studybuddyone.vercel.app

# Keep-Alive (Important!)
RENDER_EXTERNAL_URL=https://your-app.onrender.com
RENDER=true

# Optional
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 2. Enable GitHub Actions for Keep-Alive

The repository includes a GitHub Actions workflow that pings your server every 14 minutes.

**To enable it:**
1. Go to your GitHub repository
2. Click on **Actions** tab
3. Enable workflows if prompted
4. The workflow will run automatically

**To test manually:**
1. Go to **Actions** tab
2. Select "Keep Render Server Alive"
3. Click "Run workflow"

### 3. Deploy to Render

Your `render.yaml` is already configured. Simply:
1. Connect your GitHub repository to Render
2. Render will automatically deploy using the configuration
3. Wait for the build to complete

## 🔄 How Keep-Alive Works

### Internal Keep-Alive (Automatic)
The server includes a built-in keep-alive service that:
- ✅ Automatically starts in production
- ✅ Pings itself every 14 minutes
- ✅ Prevents the 15-minute timeout
- ✅ Logs all ping activity
- ✅ Gracefully shuts down when needed

### External Keep-Alive (GitHub Actions)
The GitHub Actions workflow:
- ✅ Runs every 14 minutes
- ✅ Pings your server from outside
- ✅ Provides redundancy
- ✅ Free (included with GitHub)

### Combined Benefits
Using both methods ensures:
- **99.9% uptime** on free tier
- **Fast response times** (no cold starts)
- **Reliable service** for users
- **Monitoring** via logs

## 📊 Monitoring

### Check Server Health
```bash
curl https://your-app.onrender.com/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T10:00:00.000Z",
  "uptime": "45 minutes",
  "memory": {
    "rss": "120 MB",
    "heapUsed": "45 MB",
    "heapTotal": "80 MB"
  },
  "environment": "production"
}
```

### View Logs in Render
1. Go to Render dashboard
2. Select your service
3. Click "Logs"
4. Look for:
   ```
   ✅ Keep-alive ping #1 successful at 2025-11-21T10:00:00.000Z
   ✅ Keep-alive ping #2 successful at 2025-11-21T10:14:00.000Z
   ```

### Check GitHub Actions
1. Go to repository "Actions" tab
2. View workflow runs
3. Check for successful pings

## 🎯 Resource Optimization

### Database Connection Pooling
Prisma automatically manages connection pooling:
- Efficient use of connections
- Automatic reconnection
- Query caching

### Session Management
Sessions are stored in database with automatic cleanup:
```typescript
checkPeriod: 2 * 60 * 1000  // Clean every 2 minutes
maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
```

### Memory Management
- Sessions: Database-backed (not in-memory)
- Automatic garbage collection
- Efficient query execution

## 🛠️ Troubleshooting

### Server Still Spinning Down?

**Check 1: Environment Variables**
```bash
# Verify RENDER_EXTERNAL_URL is set correctly
echo $RENDER_EXTERNAL_URL
```

**Check 2: GitHub Actions**
- Ensure workflows are enabled
- Check workflow runs for errors
- Verify cron schedule is active

**Check 3: Render Logs**
```
Search for: "Keep-alive"
Expected: ✅ Keep-alive ping successful
```

**Check 4: Health Endpoint**
```bash
curl https://your-app.onrender.com/api/health
# Should return 200 OK
```

### High Memory Usage?

**Solution 1: Optimize Queries**
```typescript
// Use select to limit returned fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, username: true, email: true }
});
```

**Solution 2: Clear Old Sessions**
The session store automatically cleans expired sessions every 2 minutes.

**Solution 3: Check Logs**
Look for memory leaks or excessive logging.

### Cold Starts Still Happening?

**Possible Causes:**
1. GitHub Actions workflow not running
2. RENDER_EXTERNAL_URL not set
3. Internal keep-alive not starting

**Verify:**
```bash
# Check if keep-alive is running
curl https://your-app.onrender.com/api/health | jq .uptime
# Uptime should be > 15 minutes if keep-alive is working
```

## 🔐 Security Best Practices

1. **Never commit secrets**
   - Use Render environment variables
   - Keep `.env` in `.gitignore`

2. **Use strong session secrets**
   ```bash
   openssl rand -hex 32
   ```

3. **Enable HTTPS only**
   - Render provides free SSL
   - Set `secure: true` for cookies in production

4. **Validate all inputs**
   - Use Prisma validation
   - Sanitize user inputs

## 💰 Cost Analysis

### Free Tier Limits
- **750 hours/month** (enough for 24/7)
- **Keep-alive overhead**: <1% of resources
- **No additional cost** for keep-alive

### When to Upgrade?
Consider paid plan if you need:
- Faster performance
- More CPU/memory
- No spin-down
- Dedicated resources
- Custom domains with SSL

## 📈 Performance Tips

1. **Database Indexing**
   ```prisma
   @@index([userId])
   @@index([createdAt])
   ```

2. **Query Optimization**
   ```typescript
   // Use include sparingly
   // Prefer select for specific fields
   ```

3. **Caching**
   ```typescript
   // Cache frequently accessed data
   // Use Redis for session storage (paid plans)
   ```

4. **Connection Management**
   ```typescript
   // Prisma handles this automatically
   // No manual connection management needed
   ```

## 🔄 Updating the Keep-Alive System

### Change Ping Interval
Edit `server/utils/keepAlive.ts`:
```typescript
private readonly PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
```

### Change GitHub Actions Schedule
Edit `.github/workflows/keepalive.yml`:
```yaml
schedule:
  - cron: '*/14 * * * *'  # Every 14 minutes
```

### Disable Keep-Alive (Not Recommended)
Set environment variable:
```
RENDER=false
```

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

## ✅ Checklist

Before deploying:
- [ ] Set all environment variables in Render
- [ ] Enable GitHub Actions workflows
- [ ] Update RENDER_EXTERNAL_URL with your Render URL
- [ ] Test health endpoint after deployment
- [ ] Check Render logs for keep-alive messages
- [ ] Verify GitHub Actions workflow runs
- [ ] Monitor uptime for 24 hours

## 🆘 Support

If you encounter issues:
1. Check Render logs
2. Review GitHub Actions runs
3. Test health endpoint
4. Verify environment variables
5. Check this guide's troubleshooting section

---

**Last Updated**: November 21, 2025
**Status**: ✅ Keep-alive system configured and ready
