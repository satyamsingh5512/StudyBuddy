# 🔄 Keep Backend Active - Cron Job Setup

## Problem
Render's free tier spins down your backend after 15 minutes of inactivity, causing 30-60 second cold starts.

## Solution
Set up a cron job to ping your backend every 14 minutes to keep it active.

---

## Option 1: External Cron Service (Recommended)

### Using cron-job.org (Free)

1. **Go to**: https://cron-job.org
2. **Sign up** for free account
3. **Create New Cron Job**:
   - **Title**: Keep StudyBuddy Active
   - **URL**: `https://YOUR-APP-NAME.onrender.com/api/health`
   - **Schedule**: Every 14 minutes
   - **Method**: GET
   - **Timeout**: 30 seconds

4. **Save** and enable

**Configuration**:
```
Title: Keep StudyBuddy Active
URL: https://YOUR-APP-NAME.onrender.com/api/health
Schedule: */14 * * * * (every 14 minutes)
Method: GET
Enabled: Yes
```

---

## Option 2: UptimeRobot (Free)

1. **Go to**: https://uptimerobot.com
2. **Sign up** for free account (50 monitors free)
3. **Add New Monitor**:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: StudyBuddy Backend
   - **URL**: `https://YOUR-APP-NAME.onrender.com/api/health`
   - **Monitoring Interval**: 5 minutes (minimum on free tier)

4. **Create Monitor**

**Benefits**:
- Also monitors uptime
- Email alerts if backend goes down
- Status page available

---

## Option 3: GitHub Actions (Free)

Create a GitHub Actions workflow that pings your backend every 14 minutes.

### Step 1: Create Workflow File

Create `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Backend Alive

on:
  schedule:
    # Runs every 14 minutes
    - cron: '*/14 * * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Backend
        run: |
          echo "Pinging backend at $(date)"
          response=$(curl -s -o /dev/null -w "%{http_code}" https://YOUR-APP-NAME.onrender.com/api/health)
          echo "Response code: $response"
          if [ $response -eq 200 ]; then
            echo "✅ Backend is alive"
          else
            echo "❌ Backend returned $response"
            exit 1
          fi
```

### Step 2: Update YOUR-APP-NAME

Replace `YOUR-APP-NAME` with your actual Render app name.

### Step 3: Commit and Push

```bash
git add .github/workflows/keep-alive.yml
git commit -m "Add keep-alive cron job"
git push
```

### Step 4: Enable Workflow

1. Go to your GitHub repository
2. Click **Actions** tab
3. Enable workflows if prompted
4. The workflow will run automatically every 14 minutes

**Note**: GitHub Actions has usage limits on free tier (2,000 minutes/month), but this uses minimal time.

---

## Option 4: Render Cron Job (Paid)

If you upgrade to Render's paid tier, you can use their built-in cron jobs.

1. **Go to** Render Dashboard
2. **Create New** → **Cron Job**
3. **Configure**:
   - **Name**: Keep Backend Alive
   - **Command**: `curl https://YOUR-APP-NAME.onrender.com/api/health`
   - **Schedule**: `*/14 * * * *`

**Cost**: $1/month (minimum)

---

## Option 5: Self-Hosted Cron (Linux/Mac)

If you have a server or computer that's always on:

### Step 1: Create Script

Create `keep-alive.sh`:

```bash
#!/bin/bash

BACKEND_URL="https://YOUR-APP-NAME.onrender.com/api/health"
LOG_FILE="$HOME/studybuddy-keepalive.log"

echo "[$(date)] Pinging $BACKEND_URL" >> "$LOG_FILE"

response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL")

if [ $response -eq 200 ]; then
    echo "[$(date)] ✅ Backend is alive (HTTP $response)" >> "$LOG_FILE"
else
    echo "[$(date)] ❌ Backend returned HTTP $response" >> "$LOG_FILE"
fi
```

### Step 2: Make Executable

```bash
chmod +x keep-alive.sh
```

### Step 3: Add to Crontab

```bash
crontab -e
```

Add this line:
```
*/14 * * * * /path/to/keep-alive.sh
```

### Step 4: Verify

```bash
crontab -l
```

---

## Recommended Setup

### For Free Tier
**Use cron-job.org or UptimeRobot**
- ✅ Free
- ✅ Reliable
- ✅ No maintenance
- ✅ Email alerts (UptimeRobot)

### For Paid Tier ($7/month)
**Upgrade to Render Starter**
- ✅ No cold starts
- ✅ Always on
- ✅ Better performance
- ✅ No cron job needed

---

## Testing Your Setup

### Test Health Endpoint

```bash
# Test your backend health endpoint
curl https://YOUR-APP-NAME.onrender.com/api/health

# Should return:
# {"status":"ok","timestamp":"2026-01-26T..."}
```

### Monitor Logs

**Render Dashboard**:
1. Go to your web service
2. Click **Logs** tab
3. Watch for health check requests every 14 minutes

You should see:
```
📨 GET /api/health
   Session ID: ...
   Authenticated: false
   User: none
```

---

## Cron Schedule Explained

```
*/14 * * * *
│   │ │ │ │
│   │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│   │ │ └───── Month (1-12)
│   │ └─────── Day of month (1-31)
│   └───────── Hour (0-23)
└─────────────── Minute (0-59)

*/14 = Every 14 minutes
```

**Why 14 minutes?**
- Render free tier spins down after 15 minutes
- 14 minutes keeps it active with 1-minute buffer
- Prevents cold starts

---

## Alternative: Upgrade to Paid Tier

Instead of using cron jobs, consider upgrading to Render's Starter tier:

```
Cost: $7/month
Benefits:
  ✅ No cold starts
  ✅ Always on
  ✅ Better performance
  ✅ More reliable
  ✅ No cron job needed
  ✅ Better for production
```

**To upgrade**:
1. Go to Render Dashboard
2. Select your web service
3. Click **Settings** → **Instance Type**
4. Select **Starter**
5. Save changes

---

## Monitoring Your Backend

### Check Uptime

**Using UptimeRobot**:
- Dashboard shows uptime percentage
- Response time graphs
- Downtime alerts

**Using Render**:
- Logs show all requests
- Metrics show response times
- Can set up alerts

### Check Logs

```bash
# Render Dashboard → Your Service → Logs
# Look for:
GET /api/health 200 OK
```

---

## Cost Comparison

### Free Tier + Cron Job
```
Render (Free):        $0/month
Cron Service (Free):  $0/month
MongoDB Atlas (Free): $0/month
Vercel (Free):        $0/month
─────────────────────────────────
Total:                $0/month

Downside: Still has brief cold starts
```

### Paid Tier (No Cron Needed)
```
Render (Starter):     $7/month
MongoDB Atlas (Free): $0/month
Vercel (Free):        $0/month
─────────────────────────────────
Total:                $7/month

Benefits: No cold starts, always on
```

---

## Quick Setup Guide

### Fastest: cron-job.org (5 minutes)

1. Go to https://cron-job.org
2. Sign up (free)
3. Create cron job:
   - URL: `https://YOUR-APP-NAME.onrender.com/api/health`
   - Schedule: Every 14 minutes
4. Enable
5. Done!

### Most Features: UptimeRobot (5 minutes)

1. Go to https://uptimerobot.com
2. Sign up (free)
3. Add monitor:
   - Type: HTTP(s)
   - URL: `https://YOUR-APP-NAME.onrender.com/api/health`
   - Interval: 5 minutes
4. Create
5. Done!

### Most Control: GitHub Actions (10 minutes)

1. Create `.github/workflows/keep-alive.yml`
2. Copy workflow from Option 3 above
3. Update YOUR-APP-NAME
4. Commit and push
5. Enable in GitHub Actions
6. Done!

---

## Troubleshooting

### Cron Job Not Working

**Check**:
1. Is the URL correct?
2. Is the backend deployed?
3. Does `/api/health` return 200?
4. Is the cron schedule correct?

**Test manually**:
```bash
curl -v https://YOUR-APP-NAME.onrender.com/api/health
```

### Backend Still Spinning Down

**Possible causes**:
1. Cron interval > 15 minutes (use 14 or less)
2. Cron service is down
3. Backend is returning errors
4. Render is having issues

**Solution**:
- Check cron service logs
- Check Render logs
- Verify health endpoint works
- Consider upgrading to paid tier

### Too Many Requests

If you're hitting rate limits:
1. Increase interval to 14 minutes (not less)
2. Use only one cron service
3. Check rate limiting middleware

---

## Best Practices

### Do's
✅ Use 14-minute interval (not less)
✅ Monitor uptime with UptimeRobot
✅ Check logs occasionally
✅ Use `/api/health` endpoint (lightweight)
✅ Set up email alerts

### Don'ts
❌ Don't use interval < 14 minutes (wastes resources)
❌ Don't use multiple cron services (redundant)
❌ Don't ping heavy endpoints (use /health)
❌ Don't forget to update URL after deployment

---

## Summary

**Recommended for Free Tier**:
1. Use **cron-job.org** or **UptimeRobot**
2. Ping every 14 minutes
3. Monitor uptime
4. Upgrade to paid tier when ready

**Recommended for Production**:
1. Upgrade to **Render Starter** ($7/month)
2. No cron job needed
3. Always on, no cold starts
4. Better user experience

---

## Files Created

- ✅ `KEEP_ALIVE_SETUP.md` - This file
- ✅ `.github/workflows/keep-alive.yml` - GitHub Actions workflow (optional)

---

**Last Updated**: January 26, 2026  
**Status**: Ready to implement  

**Choose your option and set it up in 5-10 minutes!** 🚀
