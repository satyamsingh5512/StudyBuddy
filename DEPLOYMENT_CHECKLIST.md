# Forms Subdomain Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] `vercel.json` configured with root redirect to `/forms`
- [x] Backend CORS updated to allow `forms.studybuddy.vercel.app`
- [x] API configuration supports environment variables
- [ ] Backend deployed and accessible
- [ ] Environment variables prepared

---

## 📋 Deployment Steps

### 1. Prepare Backend (If not deployed)

```bash
# Deploy backend to Render/Railway/Vercel
# Get the backend URL (e.g., https://studybuddy-api.onrender.com)
```

### 2. Deploy to Vercel

#### Option A: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import Git Repository**
   - Select: `satyamsingh5512/StudyBuddy`
4. **Configure Project**:
   - Project Name: `studybuddy-forms`
   - Framework Preset: `Vite`
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Add Environment Variables**:
   ```
   VITE_API_URL = https://your-backend-url.onrender.com
   ```
6. **Click Deploy** 🚀

#### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variable
vercel env add VITE_API_URL production
# Enter: https://your-backend-url.onrender.com
```

---

### 3. Configure Custom Domain

1. **Go to Project Settings** → **Domains**
2. **Add Domain**: `forms.studybuddy.vercel.app`
3. **Click "Add"**
4. **Wait for DNS propagation** (usually instant for Vercel subdomains)

---

### 4. Update Backend CORS (If needed)

If you need to add more origins later:

**File**: `server/index.ts`

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'https://studybuddyone.vercel.app',
  'https://forms.studybuddy.vercel.app', // ✅ Already added
  // Add more as needed
];
```

---

## 🧪 Post-Deployment Testing

Test these URLs after deployment:

```bash
# Root (should redirect to /forms)
https://forms.studybuddy.vercel.app/

# Forms Dashboard
https://forms.studybuddy.vercel.app/forms

# Create Form
https://forms.studybuddy.vercel.app/forms/new/builder

# Public Form (test with a real form ID)
https://forms.studybuddy.vercel.app/forms/f/:formId

# Form Builder (test with a real form ID)
https://forms.studybuddy.vercel.app/forms/:formId/builder

# Form Responses (test with a real form ID)
https://forms.studybuddy.vercel.app/forms/:formId/responses

# Form Analytics (test with a real form ID)
https://forms.studybuddy.vercel.app/forms/:formId/analytics
```

---

## 🔍 Verify Everything Works

- [ ] Root URL redirects to `/forms`
- [ ] Forms dashboard loads
- [ ] Can create new form
- [ ] Form builder loads and saves
- [ ] Can add/edit/delete fields
- [ ] Public form opens and submits
- [ ] Responses page shows submissions
- [ ] Analytics page shows data
- [ ] Theme toggle works on public forms
- [ ] 3-dot menu works on dashboard
- [ ] All API calls succeed (check Network tab)

---

## 🐛 Common Issues & Solutions

### Issue: API calls return 404
**Solution**: 
- Check `VITE_API_URL` environment variable in Vercel
- Verify backend is deployed and accessible
- Check browser console for actual API URL being called

### Issue: CORS errors
**Solution**:
- Verify backend `allowedOrigins` includes the forms subdomain
- Redeploy backend after CORS changes
- Clear browser cache

### Issue: Root shows blank page
**Solution**:
- Check Vercel build logs for errors
- Verify `vercel.json` rewrite rules
- Check browser console for JavaScript errors

### Issue: Authentication not working
**Solution**:
- Check cookie settings in backend
- Verify `credentials: 'include'` in API calls
- Ensure HTTPS in production (required for secure cookies)

---

## 📊 Monitoring

After deployment, monitor:

1. **Vercel Dashboard**: Check deployment status and logs
2. **Analytics**: Track page views and performance
3. **Error Logs**: Monitor for runtime errors
4. **API Logs**: Check backend logs on Render/Railway

---

## 🔄 Continuous Deployment

Once set up:

1. **Auto-deploy on git push to main branch**
2. **Preview deployments for all PRs**
3. **Instant rollback available**
4. **Zero-downtime deployments**

---

## 🎯 Environment Variables Reference

### Production (Vercel)
```bash
VITE_API_URL=https://your-backend-url.onrender.com
```

### Development (Local)
```bash
VITE_API_URL=http://localhost:3001
```

---

## 📝 Deployment Notes

- **Build Time**: 2-3 minutes
- **Deploy Time**: <30 seconds
- **Global CDN**: Automatic via Vercel Edge Network
- **SSL**: Automatic HTTPS with Vercel certificates
- **Custom Domains**: Free SSL for custom domains too

---

## 🚀 Next Steps After Deployment

1. [ ] Test all features on production
2. [ ] Set up monitoring and alerts
3. [ ] Configure custom domain (optional)
4. [ ] Add to your main website navigation
5. [ ] Share public forms with users
6. [ ] Monitor performance and usage

---

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Deployment Guide**: See `FORMS_DEPLOYMENT_GUIDE.md`
- **GitHub Repo**: https://github.com/satyamsingh5512/StudyBuddy

---

**Last Updated**: {{ DATE }}  
**Version**: 1.0.0  
**Deployment Target**: forms.studybuddy.vercel.app
