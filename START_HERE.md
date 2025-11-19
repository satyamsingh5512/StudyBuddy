# 🚀 START HERE - StudyBuddy Setup

Welcome! Follow these steps to get StudyBuddy running.

## ✅ Step 1: Dependencies (Already Done!)

You've already run `npm install`. Great!

## 📊 Step 2: Check Your Configuration

Run this command to see what's missing:

```bash
npm run check
```

## 🗄️ Step 3: Set Up Database

You need a PostgreSQL database. **We recommend Neon** (easiest):

### Quick Neon Setup (5 minutes):

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project
3. Copy the connection string
4. Update `.env` file:
   ```env
   DATABASE_URL="your-neon-connection-string-here"
   ```

**See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions and alternatives.**

## 🔄 Step 4: Push Database Schema

Once your database is configured:

```bash
npm run db:push
```

You should see: `✔ Your database is now in sync with your Prisma schema.`

## ✅ Step 5: Verify Everything

```bash
npm run check
```

Should show all ✅ (except Gemini API which is optional).

## 🎉 Step 6: Start the App!

```bash
npm run dev
```

Open http://localhost:5173 in your browser!

## 🎯 What You'll See

1. **Landing Page** - Beautiful homepage with features
2. Click **"Get Started"** - Sign in with Google
3. **Dashboard** - Your personalized study hub
4. Start adding tasks and tracking progress!

## 📚 Additional Resources

- **[QUICKSTART.md](./QUICKSTART.md)** - Detailed setup guide
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database options
- **[SETUP.md](./SETUP.md)** - Complete documentation
- **[README.md](./README.md)** - Project overview

## 🐛 Having Issues?

### Server won't start?
- Check `.env` file has correct values
- Run `npm run check` to verify configuration

### Can't connect to database?
- See [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- Try using Neon instead of local PostgreSQL

### Google OAuth not working?
- Your credentials are already set in `.env`
- Make sure you added the redirect URI in Google Console:
  ```
  http://localhost:3001/api/auth/google/callback
  ```

## 💡 Quick Tips

- **Database**: Use Neon - it's free and requires zero local setup
- **Gemini API**: Optional - you can skip it initially
- **Ports**: Make sure 3001 and 5173 are available

## 🆘 Still Stuck?

1. Check server console for error messages
2. Verify all `.env` values
3. Make sure database is accessible
4. Try restarting: `Ctrl+C` then `npm run dev` again

---

**Ready?** Run `npm run dev` and visit http://localhost:5173! 🎉
