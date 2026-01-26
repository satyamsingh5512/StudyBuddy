# Deployment Checklist

## ✅ Pre-Deployment

### Backend (Render)
- [x] Dockerfile created and tested
- [x] Environment variables configured
- [x] MongoDB connection string added
- [x] CORS origins configured
- [x] Session secret set
- [ ] SMTP credentials added (optional)
- [ ] Google OAuth credentials added (optional)
- [ ] Groq API key added (optional)

### Frontend (Vercel)
- [x] Vercel.json configured
- [ ] VITE_API_URL environment variable set
- [x] Build command verified
- [x] Output directory set to `dist`

### Code Quality
- [x] All API endpoints use correct paths
- [x] No hardcoded URLs in frontend
- [x] Error handling in place
- [x] Timeouts configured for external services
- [x] CORS properly configured

## 🚀 Deployment Steps

### 1. Deploy Backend to Render
```bash
# Push to GitHub (triggers Render auto-deploy)
git push origin main

# Or manual deploy via Render dashboard
```

**Wait for:** Build logs show successful deployment
**Verify:** Visit `https://your-app.onrender.com/api/health`
**Expected:** `{"status":"ok","timestamp":"..."}`

### 2. Get Render URL
- Go to Render dashboard
- Copy your service URL (e.g., `https://studybuddy-xyz.onrender.com`)

### 3. Configure Vercel Environment
- Go to Vercel dashboard → Your project → Settings → Environment Variables
- Add: `VITE_API_URL` = Your Render URL
- Select: Production, Preview, Development

### 4. Update Render CORS
- Go to Render dashboard → Your service → Environment
- Add: `ALLOWED_ORIGINS` = Your Vercel URL
- Add: `FRONTEND_URL` = Your Vercel URL
- Save (service will restart)

### 5. Deploy Frontend to Vercel
```bash
# Push to GitHub (triggers Vercel auto-deploy)
git push origin main

# Or manual deploy
npx vercel --prod
```

**Wait for:** Build logs show successful build
**Verify:** Visit your Vercel URL
**Expected:** App loads without errors

## 🧪 Post-Deployment Testing

### Quick Smoke Test
1. [ ] Homepage loads
2. [ ] Can navigate to auth page
3. [ ] Can sign up (creates account)
4. [ ] Receives OTP (check console if email not configured)
5. [ ] Can verify email with OTP
6. [ ] Redirects to dashboard after verification
7. [ ] Dashboard shows user data
8. [ ] Can create a todo
9. [ ] Can logout
10. [ ] Can login again

### Browser Console Check
1. Open DevTools (F12)
2. Check Console tab
   - [ ] No CORS errors
   - [ ] No 404 errors
   - [ ] No authentication errors
3. Check Network tab
   - [ ] API calls go to Render backend
   - [ ] Responses are 200 OK
   - [ ] Cookies are set

### Backend Health Check
```bash
# Test health endpoint
curl https://your-render-app.onrender.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-26T..."}
```

### Session Persistence Test
1. [ ] Login to app
2. [ ] Refresh page
3. [ ] Still logged in (not redirected to auth)
4. [ ] Close browser
5. [ ] Open browser again
6. [ ] Visit app URL
7. [ ] Still logged in

## 🔧 Troubleshooting

### Issue: CORS Error
**Symptoms:** 
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Solution:**
1. Check `ALLOWED_ORIGINS` in Render includes your Vercel URL
2. Restart Render service
3. Clear browser cache
4. Try again

### Issue: 404 Not Found
**Symptoms:**
```
GET https://your-app.vercel.app/api/... 404
```

**Solution:**
1. Verify `VITE_API_URL` is set in Vercel
2. Check it points to your Render URL
3. Redeploy Vercel app
4. Clear browser cache

### Issue: Session Not Persisting
**Symptoms:** Logged out after page refresh

**Solution:**
1. Check browser cookies (DevTools → Application → Cookies)
2. Verify `studybuddy.sid` cookie exists
3. Check cookie attributes (Secure, SameSite)
4. Verify MongoDB connection in Render logs
5. Check session store configuration

### Issue: Slow First Load
**Symptoms:** First request takes 30+ seconds

**Solution:**
- This is normal for Render free tier (service sleeps)
- First request wakes the service
- Subsequent requests are fast
- Use keep-alive workflow or upgrade plan

### Issue: Email Not Sending
**Symptoms:** OTP not received, request times out

**Solution:**
1. Check Render logs for email errors
2. Verify SMTP credentials are correct
3. For Gmail, use App Password (not regular password)
4. Check OTP in Render logs (logged to console)
5. In development, OTP is included in API response

## 📊 Monitoring

### Render Dashboard
- Check deployment status
- View real-time logs
- Monitor resource usage
- Check service health

### Vercel Dashboard
- Check deployment status
- View build logs
- Monitor function logs
- Check analytics

### MongoDB Atlas
- Monitor database connections
- Check query performance
- View storage usage
- Set up alerts

## 🔄 Continuous Deployment

### Automatic Deployment
Both Render and Vercel are configured for auto-deploy:
1. Push to GitHub main branch
2. Render rebuilds backend automatically
3. Vercel rebuilds frontend automatically
4. Changes go live in ~2-5 minutes

### Manual Deployment
```bash
# Backend (via Render dashboard)
Render Dashboard → Your Service → Manual Deploy → Deploy latest commit

# Frontend (via Vercel CLI)
npx vercel --prod
```

## 🎯 Success Criteria

Deployment is successful when:
- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] No CORS errors in browser console
- [ ] Can sign up and login
- [ ] Session persists across page reloads
- [ ] All API calls reach backend successfully
- [ ] Database operations work (create/read/update/delete)
- [ ] Real-time features work (if applicable)

## 📝 Post-Deployment Tasks

### Immediate
- [ ] Test all critical user flows
- [ ] Check error logs for issues
- [ ] Verify email service (if configured)
- [ ] Test on different browsers
- [ ] Test on mobile devices

### Within 24 Hours
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review user feedback
- [ ] Fix any critical bugs

### Within 1 Week
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy
- [ ] Document any issues found
- [ ] Plan next iteration

## 🆘 Emergency Rollback

If deployment fails critically:

### Render
1. Go to Render dashboard
2. Click on your service
3. Go to "Events" tab
4. Find previous successful deployment
5. Click "Redeploy"

### Vercel
1. Go to Vercel dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Find previous successful deployment
5. Click "..." → "Promote to Production"

## 📞 Support Resources

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- Project Issues: https://github.com/satyamsingh5512/StudyBuddy/issues

## ✨ Next Steps

After successful deployment:
1. Set up custom domain (if not already done)
2. Configure SSL certificate
3. Set up monitoring and alerts
4. Plan feature roadmap
5. Gather user feedback
6. Iterate and improve
