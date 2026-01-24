# Quick MongoDB Fix - Get OTP Working NOW

## 🚨 Current Issue
MongoDB Atlas has TLS/SSL errors → Database not connected → Signup fails → No OTP generated

## ⚡ FASTEST Solution (5 minutes)

### Option 1: Install MongoDB Locally (Ubuntu/Debian)

```bash
# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify it's running
sudo systemctl status mongodb
```

Then update `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/studybuddy
```

Restart server:
```bash
npm run dev:server
```

### Option 2: Use Docker (If you have Docker)

```bash
# Start MongoDB container
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  mongo:latest

# Verify it's running
docker ps
```

Then update `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/studybuddy
```

Restart server:
```bash
npm run dev:server
```

### Option 3: Create NEW MongoDB Atlas Cluster

1. Go to https://cloud.mongodb.com/
2. Sign in
3. Click "Build a Database" → Choose **M0 FREE**
4. Click "Create"
5. Wait 3-5 minutes
6. Create database user:
   - Username: `studybuddy_user`
   - Password: (generate and save it)
   - Role: "Read and write to any database"
7. Network Access:
   - Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0)
8. Get connection string:
   - Click "Connect" → "Drivers"
   - Copy the connection string
   - Replace `<password>` with your actual password
9. Update `.env`:
   ```env
   MONGODB_URI=mongodb+srv://studybuddy_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/studybuddy?retryWrites=true&w=majority
   ```

---

## 🧪 Test After Setup

Run this to verify MongoDB is working:

```bash
node test-mongodb-connection.mjs
```

You should see:
```
✅ Successfully connected to MongoDB!
✅ Write test successful
✅ Read test successful
✅ All tests passed!
```

Then restart your server:
```bash
npm run dev:server
```

---

## 📧 After MongoDB is Working

Once MongoDB connects successfully:

1. Go to `http://localhost:5173/auth`
2. Click "Sign up"
3. Enter your details
4. Click "Create Account"
5. **Check the server terminal** for OTP:
   ```
   📧 OTP for your-email@example.com: 123456
   ```
6. Enter the OTP to verify

---

## 💡 Why OTP Wasn't Showing

The flow is:
1. User clicks "Sign up"
2. Server tries to save user to MongoDB
3. **MongoDB connection fails** ❌
4. Signup fails before OTP generation
5. No OTP displayed

Once MongoDB is connected:
1. User clicks "Sign up"
2. Server saves user to MongoDB ✅
3. Server generates OTP ✅
4. Server logs OTP to console ✅
5. You can see and use the OTP ✅

---

## 🎯 Recommended: Install MongoDB Locally

For development, local MongoDB is:
- ✅ Faster (no network latency)
- ✅ No TLS issues
- ✅ Works offline
- ✅ Free and unlimited
- ✅ Easy to reset/clear data

### Install Commands by OS:

**Ubuntu/Debian:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
Download from: https://www.mongodb.com/try/download/community

---

## ✅ Verification Checklist

After setup, verify:

- [ ] MongoDB is running (`sudo systemctl status mongodb` or `docker ps`)
- [ ] `.env` has correct MONGODB_URI
- [ ] Server restarted after `.env` change
- [ ] Test connection passes (`node test-mongodb-connection.mjs`)
- [ ] Server shows "✅ MongoDB connected"
- [ ] Signup creates user successfully
- [ ] OTP appears in server logs

---

## 🆘 Still Not Working?

If MongoDB is connected but OTP still doesn't show:

1. Check server logs for errors
2. Make sure email/password/name are filled in signup form
3. Check browser console for errors
4. Try a different email address
5. Clear browser cache and try again

---

**Once MongoDB is connected, OTP will work immediately!** 🎉
