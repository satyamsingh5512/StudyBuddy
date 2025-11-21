# 🚀 Forms Subdomain Deployment - Quick Start

## What Changed?

### ✅ Files Modified

1. **`vercel.json`**
   - Added root redirect: `/` → `/forms`
   - Configured SPA rewrites
   - Ready for Vercel deployment

2. **`server/index.ts`**
   - Updated CORS to support multiple origins
   - Added `forms.studybuddy.vercel.app` to allowed origins
   - Supports localhost + main app + forms subdomain

3. **`.env.example`**
   - Added deployment notes
   - Documented environment variables

### 📄 New Documentation

1. **`FORMS_DEPLOYMENT_GUIDE.md`** - Complete deployment guide
2. **`DEPLOYMENT_CHECKLIST.md`** - Step-by-step checklist

---

## 🎯 Quick Deploy (3 Steps)

### Step 1: Deploy to Vercel

```bash
# Option A: Use Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your GitHub repo
4. Deploy!

# Option B: Use Vercel CLI
vercel --prod
```

### Step 2: Add Environment Variable

In Vercel Project Settings → Environment Variables:
```
VITE_API_URL = https://your-backend-url.onrender.com
```

### Step 3: Configure Domain

Settings → Domains → Add:
```
forms.studybuddy.vercel.app
```

**Done!** 🎉

---

## 🌐 URL Structure

After deployment:

| URL | Purpose |
|-----|---------|
| `https://forms.studybuddy.vercel.app/` | Redirects to Forms Dashboard |
| `https://forms.studybuddy.vercel.app/forms` | Forms Dashboard |
| `https://forms.studybuddy.vercel.app/forms/:id/builder` | Form Builder |
| `https://forms.studybuddy.vercel.app/forms/f/:id` | Public Form (Fill) |
| `https://forms.studybuddy.vercel.app/forms/:id/responses` | View Responses |
| `https://forms.studybuddy.vercel.app/forms/:id/analytics` | View Analytics |

---

## ✨ Features Enabled

- ✅ Root URL redirects to forms
- ✅ Multi-origin CORS support
- ✅ Environment-based API configuration
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Zero-downtime deployments
- ✅ Preview deployments for PRs

---

## 🔧 Configuration Summary

### Frontend (Vercel)
```json
// vercel.json
{
  "rewrites": [
    { "source": "/", "destination": "/forms" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Backend (Render/Railway)
```typescript
// server/index.ts
const allowedOrigins = [
  'http://localhost:5173',
  'https://studybuddyone.vercel.app',
  'https://forms.studybuddy.vercel.app', // ✅ Added
];
```

---

## 📋 Pre-Deployment Checklist

- [x] `vercel.json` configured
- [x] Backend CORS updated
- [x] Documentation created
- [ ] Backend deployed (if not already)
- [ ] Environment variables ready
- [ ] Ready to deploy!

---

## 🐛 Troubleshooting

### Issue: API calls fail (404/CORS)
**Fix**: Add backend URL to `VITE_API_URL` in Vercel environment variables

### Issue: Root shows 404
**Fix**: Verify `vercel.json` is in root directory and redeploy

### Issue: Authentication not working
**Fix**: Check backend CORS includes forms subdomain

---

## 📚 Full Documentation

For detailed instructions, see:
- **`FORMS_DEPLOYMENT_GUIDE.md`** - Complete deployment guide
- **`DEPLOYMENT_CHECKLIST.md`** - Step-by-step checklist
- **`.env.example`** - Environment variables reference

---

## 🎉 Next Steps

1. **Deploy to Vercel** using dashboard or CLI
2. **Add domain** `forms.studybuddy.vercel.app`
3. **Test all features** on production
4. **Monitor** performance in Vercel dashboard
5. **Share** with users!

---

**Ready to deploy?** Follow the guide in `DEPLOYMENT_CHECKLIST.md`! 🚀
