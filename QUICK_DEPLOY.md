# ⚡ Quick Deploy Guide - 5 Minutes

## 🚀 Deploy Backend to Render

### 1. Create Service (2 minutes)
1. Go to [render.com](https://render.com) → Sign up with GitHub
2. Click "New +" → "Web Service"
3. Connect your StudyBuddy repo
4. Configure:
   - **Name**: `studybuddy-api`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Instance**: Starter ($7/month) or Free

### 2. Add Environment Variables (2 minutes)
Copy-paste these into Render:

```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://studybuddy5512_db_user:Iwillbe@cluster0.tcd7xh3.mongodb.net/studybuddy?retryWrites=true&w=majority
SESSION_SECRET=your-random-secret-key-min-32-chars
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://studybuddy-api.onrender.com/api/auth/google/callback
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GROQ_API_KEY=your_groq_api_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=https://sbd.satym.site
ALLOWED_ORIGINS=https://sbd.satym.site,https://studybuddyone.vercel.app
```

### 3. Deploy (1 minute)
Click "Create Web Service" → Wait 5-10 minutes

Your backend URL: `https://studybuddy-api.onrender.com`

---

## 🌐 Deploy Frontend to Vercel

### 1. Add Environment Variable (1 minute)
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   ```
   VITE_API_URL=https://studybuddy-api.onrender.com/api
   ```

### 2. Redeploy (1 minute)
```bash
git add .
git commit -m "Configure for Render backend"
git push origin main
```

Or: `vercel --prod`

---

## ✅ Test (1 minute)

```bash
# Test backend
curl https://studybuddy-api.onrender.com/api/health

# Test frontend
# Visit https://sbd.satym.site
# Try signup/login
# Test chat
```

---

## 🎉 Done!

**Total time**: ~15 minutes (including deployment wait time)

**For detailed guide**: See `RENDER_DEPLOYMENT.md`

---

## 💡 Quick Tips

### If using Free tier:
- First request after 15 min takes 30-50 seconds (cold start)
- Subsequent requests are fast
- Consider upgrading to Starter ($7/month) for always-on

### If chat not working:
1. Check `VITE_API_URL` in Vercel
2. Check `ALLOWED_ORIGINS` in Render
3. Check browser console for errors

### If OAuth not working:
1. Update Google OAuth callbacks:
   ```
   https://studybuddy-api.onrender.com/api/auth/google/callback
   ```

---

## 📞 Need Help?

- **Full Guide**: `RENDER_DEPLOYMENT.md`
- **Troubleshooting**: `DEPLOYMENT_READY.md`
- **Features**: `CURRENT_SETUP.md`
