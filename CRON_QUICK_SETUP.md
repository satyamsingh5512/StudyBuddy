# ⚡ Quick Cron Setup - 5 Minutes

## 🎯 Goal
Keep your Render backend active to prevent cold starts (30-60 second delays).

---

## ✅ Recommended: cron-job.org (Easiest)

### Step 1: Sign Up
Go to **https://cron-job.org** and create a free account.

### Step 2: Create Cron Job
1. Click **"Create cronjob"**
2. Fill in:
   ```
   Title: StudyBuddy Keep-Alive
   URL: https://YOUR-APP-NAME.onrender.com/api/health
   Execution schedule: Every 14 minutes
   ```
3. Click **"Create cronjob"**

### Step 3: Done!
Your backend will now be pinged every 14 minutes automatically.

**Replace `YOUR-APP-NAME`** with your actual Render app name!

---

## 🔄 Alternative: GitHub Actions (Free)

### Step 1: Update Workflow File
Open `.github/workflows/keep-alive.yml` and replace:
```yaml
https://YOUR-APP-NAME.onrender.com/api/health
```
with your actual Render URL.

### Step 2: Commit and Push
```bash
git add .github/workflows/keep-alive.yml
git commit -m "Add keep-alive cron job"
git push
```

### Step 3: Enable in GitHub
1. Go to your GitHub repository
2. Click **Actions** tab
3. Enable workflows if prompted
4. Done!

The workflow will run automatically every 14 minutes.

---

## 📊 Alternative: UptimeRobot (Best Monitoring)

### Step 1: Sign Up
Go to **https://uptimerobot.com** and create a free account.

### Step 2: Add Monitor
1. Click **"Add New Monitor"**
2. Fill in:
   ```
   Monitor Type: HTTP(s)
   Friendly Name: StudyBuddy Backend
   URL: https://YOUR-APP-NAME.onrender.com/api/health
   Monitoring Interval: 5 minutes
   ```
3. Click **"Create Monitor"**

### Step 3: Done!
You'll also get:
- ✅ Uptime monitoring
- ✅ Email alerts if backend goes down
- ✅ Status page

---

## 🧪 Test Your Setup

### Test Health Endpoint
```bash
curl https://YOUR-APP-NAME.onrender.com/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-01-26T..."}
```

### Monitor Logs
1. Go to Render Dashboard
2. Select your web service
3. Click **Logs** tab
4. Watch for health check requests every 14 minutes

---

## 💡 Why 14 Minutes?

- Render free tier spins down after **15 minutes** of inactivity
- Pinging every **14 minutes** keeps it active
- 1-minute buffer for reliability

---

## 💰 Cost Comparison

### Free Tier + Cron
```
Cost: $0/month
Pros: Free
Cons: Brief cold starts still possible
```

### Paid Tier (No Cron Needed)
```
Cost: $7/month
Pros: Always on, no cold starts, better performance
Cons: Costs money
```

**Recommendation**: Start with free + cron, upgrade when you have users.

---

## 📚 More Details

See **KEEP_ALIVE_SETUP.md** for:
- Detailed setup instructions
- All available options
- Troubleshooting guide
- Best practices

---

## ✅ Quick Checklist

- [ ] Choose a cron service (cron-job.org recommended)
- [ ] Sign up for free account
- [ ] Create cron job with your Render URL
- [ ] Test health endpoint
- [ ] Monitor logs to verify it's working
- [ ] Done!

**Time**: 5 minutes  
**Cost**: $0  
**Difficulty**: Easy  

---

**Ready? Pick cron-job.org and set it up now!** 🚀
