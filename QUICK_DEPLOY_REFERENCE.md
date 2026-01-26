# ⚡ Quick Deploy Reference Card

## 🚀 Deploy in 3 Steps (40 minutes)

### 1️⃣ Deploy Backend to Render (15 min)

```
1. Go to: https://render.com
2. New Web Service → Connect GitHub
3. Configure:
   - Build: npm install
   - Start: npm run start:server
   - Instance: Starter ($7/month)
4. Add env vars from .env.production.example
5. Deploy → Copy URL
```

### 2️⃣ Deploy Frontend to Vercel (10 min)

```
1. Go to: https://vercel.com
2. Import GitHub repo
3. Add env var:
   VITE_API_URL=https://your-render-url.onrender.com/api
4. Deploy
```

### 3️⃣ Update & Test (15 min)

```
1. Update OAuth callback in Google Console
2. Update CLIENT_URL in Render
3. Test: curl https://your-render-url.onrender.com/api/health
4. Visit your Vercel URL and test features
```

---

## 📋 Environment Variables

### Render (Backend)
```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=your_mongodb_uri
SESSION_SECRET=random-32-char-string
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback
GROQ_API_KEY=your_key
EMAIL_USER=your_email
EMAIL_PASS=your_password
CLIENT_URL=https://your-vercel-url.vercel.app
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
```

### Vercel (Frontend)
```bash
VITE_API_URL=https://your-app.onrender.com/api
```

---

## 🧪 Quick Tests

```bash
# Backend health
curl https://your-app.onrender.com/api/health

# Frontend
# Visit your Vercel URL
# Try signup → OTP → Login → Chat
```

---

## 💰 Cost

- **Free**: $0/month (with cold starts)
- **Recommended**: $7/month (always on)

---

## 📚 Full Guides

- **Detailed Steps**: `DEPLOYMENT_STEPS.md`
- **Checklist**: `PRE_DEPLOYMENT_CHECKLIST.md`
- **Readiness**: `DEPLOYMENT_READY_FINAL.md`

---

## 🆘 Common Issues

**CORS Error**
→ Check `CLIENT_URL` and `ALLOWED_ORIGINS` in Render

**404 on API**
→ Check `VITE_API_URL` in Vercel

**Socket.IO not connecting**
→ Verify backend URL in Vercel env var

---

**Ready? Start with Step 1!** 🚀
