# Forms Subdomain Deployment Guide

This guide will help you deploy the StudyBuddy Forms feature as a separate Vercel project with a custom subdomain.

## 📋 Prerequisites

- Vercel account (https://vercel.com)
- Git repository pushed to GitHub
- Vercel CLI installed (optional): `npm i -g vercel`

---

## 🚀 Deployment Steps

### Step 1: Create New Vercel Project

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Project Name**: `studybuddy-forms`
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (keep default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

### Step 2: Configure Environment Variables

Add these environment variables in Vercel project settings:

```bash
# Backend API URL (use your backend deployment URL)
VITE_API_URL=https://your-backend.onrender.com

# Or if using Vercel for backend too
VITE_API_URL=https://studybuddy-api.vercel.app
```

### Step 3: Deploy

Click **"Deploy"** and wait for the build to complete.

---

## 🌐 Custom Domain Setup

### Option A: Vercel Subdomain (Recommended for Testing)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Add domain: `forms.studybuddy.vercel.app`
4. Click **"Add"**
5. Vercel will automatically configure it ✅

### Option B: Custom Domain (Production)

If you own `studybuddy.com`:

1. Go to **Settings** → **Domains**
2. Add domain: `forms.studybuddy.com`
3. Follow Vercel's DNS configuration instructions:
   - Add CNAME record: `forms` → `cname.vercel-dns.com`
4. Wait for DNS propagation (5-30 minutes)

---

## 📁 What's Configured

### Root Redirect
The `vercel.json` now redirects:
- `https://forms.studybuddy.vercel.app/` → `/forms` page

### Rewrites Configuration
```json
{
  "rewrites": [
    {
      "source": "/",
      "destination": "/forms"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This means:
- Root path (`/`) shows the forms dashboard
- All other routes work as SPAs
- `/forms/f/:id` for public forms
- `/forms/:id/builder` for form builder
- `/forms/:id/responses` for responses
- `/forms/:id/analytics` for analytics

---

## 🔧 Post-Deployment Configuration

### Update API URLs

If your backend is deployed separately, update the CORS settings:

**Backend (server/index.ts):**
```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'https://studybuddyone.vercel.app',
  'https://forms.studybuddy.vercel.app', // Add this
];
```

### Update vercel.json CORS (if needed)

In `vercel.json`, update the Access-Control-Allow-Origin:

```json
{
  "key": "Access-Control-Allow-Origin",
  "value": "https://forms.studybuddy.vercel.app"
}
```

---

## ✅ Testing Checklist

After deployment, test these URLs:

- [ ] Root: `https://forms.studybuddy.vercel.app/` → Should show forms dashboard
- [ ] Forms: `https://forms.studybuddy.vercel.app/forms` → Forms dashboard
- [ ] Builder: `https://forms.studybuddy.vercel.app/forms/:id/builder` → Form builder
- [ ] Public Form: `https://forms.studybuddy.vercel.app/forms/f/:id` → Public form
- [ ] Responses: `https://forms.studybuddy.vercel.app/forms/:id/responses` → Responses
- [ ] Analytics: `https://forms.studybuddy.vercel.app/forms/:id/analytics` → Analytics

---

## 🐛 Troubleshooting

### Issue: 404 on refresh
**Solution**: Already configured! The `vercel.json` has SPA rewrite rules.

### Issue: API calls failing
**Solution**: 
1. Check `VITE_API_URL` environment variable
2. Verify backend CORS allows the forms subdomain
3. Check browser console for CORS errors

### Issue: Root shows 404 instead of forms
**Solution**: 
1. Verify `vercel.json` has the root rewrite
2. Redeploy the project
3. Clear Vercel cache: Settings → Functions → Clear Cache

### Issue: Styles not loading
**Solution**:
1. Check build logs for CSS errors
2. Verify Tailwind config is correct
3. Ensure `index.css` is imported in `main.tsx`

---

## 🚀 Quick Deploy Commands

Using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variable
vercel env add VITE_API_URL production
```

---

## 📊 Monitoring

After deployment:

1. **Analytics**: Check Vercel dashboard for traffic stats
2. **Logs**: View function logs in Vercel dashboard
3. **Performance**: Use Vercel Speed Insights
4. **Errors**: Enable Error Tracking in project settings

---

## 🔄 Continuous Deployment

Once connected to GitHub:

1. Every push to `main` branch auto-deploys
2. Preview deployments for PRs
3. Rollback available in Vercel dashboard

---

## 📝 Notes

- **Build Time**: ~2-3 minutes
- **Cold Start**: <1 second (serverless functions)
- **Region**: Automatically optimized globally via Vercel Edge Network
- **SSL**: Automatic HTTPS with Vercel's SSL certificates

---

## 🎯 Next Steps

1. Deploy backend to Render/Railway/Vercel
2. Update `VITE_API_URL` environment variable
3. Test all form features on production
4. Set up monitoring and alerts
5. Configure custom domain (optional)

---

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- GitHub Issues: https://github.com/satyamsingh5512/StudyBuddy/issues
- Discord: (Add your support channel)

---

**Deployment Date**: {{ DATE }}  
**Version**: 1.0.0  
**Subdomain**: forms.studybuddy.vercel.app
