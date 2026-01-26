# Frontend-Backend Connection Test

## Quick Connection Test

### 1. Test Backend Health (from browser or terminal)

```bash
# Replace with your actual Render URL
curl https://your-render-app.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-26T..."}
```

### 2. Test from Frontend

Open your browser console on the Vercel app and run:

```javascript
// Test basic connection
fetch('https://your-render-app.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test with credentials (for authenticated endpoints)
fetch('https://your-render-app.onrender.com/api/auth/check', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Common Issues & Solutions

### Issue 1: CORS Error
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```

**Solution:**
1. Add your Vercel URL to Render environment variables:
   - `ALLOWED_ORIGINS=https://your-app.vercel.app`
2. Restart your Render service
3. Clear browser cache and try again

### Issue 2: 404 Not Found
```
GET https://your-render-app.onrender.com/api/... 404
```

**Solution:**
- Check that `VITE_API_URL` is set correctly in Vercel
- Verify the API endpoint exists in your backend
- Check Render logs for errors

### Issue 3: Session/Cookie Issues
```
User not authenticated / Session not persisting
```

**Solution:**
1. Ensure cookies are set with correct attributes:
   - `sameSite: 'none'` in production
   - `secure: true` in production
2. Check that `credentials: 'include'` is in all fetch calls
3. Verify MongoDB connection for session store

### Issue 4: Render Service Sleeping
```
Request takes 30+ seconds on first load
```

**Solution:**
- Render free tier services sleep after inactivity
- First request wakes the service (slow)
- Consider using the keep-alive script in `.github/workflows/keep-alive.yml`
- Or upgrade to paid Render plan

## Environment Variables Checklist

### Vercel (Frontend)
- [ ] `VITE_API_URL` = Your Render backend URL

### Render (Backend)
- [ ] `FRONTEND_URL` = Your Vercel frontend URL
- [ ] `ALLOWED_ORIGINS` = Your Vercel frontend URL
- [ ] `MONGODB_URI` = Your MongoDB connection string
- [ ] `SESSION_SECRET` = Random secret string
- [ ] `GOOGLE_CLIENT_ID` = Your Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` = Your Google OAuth secret
- [ ] `GROQ_API_KEY` = Your Groq API key
- [ ] `NODE_ENV` = production

## Testing Checklist

After deployment, test these features:

- [ ] Homepage loads
- [ ] Login/Signup works
- [ ] Google OAuth works
- [ ] Dashboard loads user data
- [ ] Todo CRUD operations work
- [ ] AI chat works
- [ ] Real-time features work (if using Socket.IO)
- [ ] Session persists across page reloads

## Monitoring

### Check Render Logs
```bash
# Via Render Dashboard
https://dashboard.render.com → Your Service → Logs
```

### Check Vercel Logs
```bash
# Via Vercel Dashboard
https://vercel.com/dashboard → Your Project → Deployments → View Function Logs
```

### Check Browser Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Look for API calls to your Render backend
5. Check response status and headers

## Performance Tips

1. **Enable Compression**: Already configured in `server/app.ts`
2. **Use Caching**: API responses are cached in `src/config/api.ts`
3. **Optimize Images**: Use WebP format and lazy loading
4. **Monitor Bundle Size**: Check Vercel build logs
5. **Use CDN**: Vercel automatically uses Edge Network

## Need Help?

- Check `VERCEL_SETUP.md` for setup instructions
- Check `RENDER_DEPLOYMENT_FIX.md` for backend issues
- Review server logs on Render dashboard
- Check browser console for frontend errors
