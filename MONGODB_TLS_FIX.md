# MongoDB TLS/SSL Connection Fix

## Problem
Getting `tlsv1 alert internal error` when connecting to MongoDB Atlas with Node.js v22.

## Root Cause
Node.js v22 has stricter TLS/SSL requirements that conflict with some MongoDB Atlas configurations.

---

## ✅ Solution 1: Update MongoDB Connection (Recommended)

I've already applied this fix. The changes include:

### 1. Updated `server/lib/mongodb.ts`
Added explicit TLS configuration:
```typescript
mongoClient = new MongoClient(MONGODB_URL, {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 10000, // Increased timeout
  tls: true, // Explicitly enable TLS
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
});
```

### 2. Updated `.env` file
Added TLS parameters to connection string:
```env
MONGODB_URI=mongodb+srv://studybuddy5512_db_user:Iwillbe@cluster0.rwlwl7d.mongodb.net/studybuddy?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=false
```

### 3. Restart the Server
```bash
# Stop the server (Ctrl+C)
npm run dev:server
```

---

## 🔧 Solution 2: Downgrade Node.js (If Solution 1 Doesn't Work)

If the above doesn't work, you can use Node.js v20 (LTS):

### Using nvm (Node Version Manager):
```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js v20
nvm install 20

# Use Node.js v20
nvm use 20

# Verify
node --version  # Should show v20.x.x

# Restart server
npm run dev:server
```

### Using n (Node version manager):
```bash
# Install n
sudo npm install -g n

# Install Node.js v20
sudo n 20

# Verify
node --version

# Restart server
npm run dev:server
```

---

## 🛠️ Solution 3: Update MongoDB Driver (Alternative)

If you want to stay on Node.js v22:

```bash
# Update MongoDB driver to latest version
npm install mongodb@latest

# Restart server
npm run dev:server
```

---

## 🔍 Solution 4: Verify MongoDB Atlas Configuration

### Check IP Whitelist:
1. Go to MongoDB Atlas Dashboard
2. Click **Network Access**
3. Make sure your IP is whitelisted or use `0.0.0.0/0` (allow all) for testing

### Check Database User:
1. Go to **Database Access**
2. Verify user `studybuddy5512_db_user` exists
3. Check password is correct: `Iwillbe`
4. Ensure user has "Read and write to any database" permissions

### Check Cluster Status:
1. Go to **Database** → **Clusters**
2. Make sure cluster is running (not paused)
3. Check cluster tier (M0 free tier should work)

---

## 🧪 Testing the Connection

### Test 1: Direct Connection Test
Create `test-mongo.js`:

```javascript
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function testConnection() {
  const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ MongoDB connected successfully!');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('📦 Collections:', collections.map(c => c.name));
    
    await client.close();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
```

Run it:
```bash
node test-mongo.js
```

### Test 2: Check Node.js Version
```bash
node --version
```

If you see `v22.x.x`, consider downgrading to v20 (LTS).

### Test 3: Check OpenSSL Version
```bash
node -p "process.versions.openssl"
```

---

## 🚨 Quick Fixes

### Fix 1: Allow Invalid Certificates (Development Only)
⚠️ **Only use this for local development, NOT production!**

Update `.env`:
```env
MONGODB_URI=mongodb+srv://studybuddy5512_db_user:Iwillbe@cluster0.rwlwl7d.mongodb.net/studybuddy?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true
```

And update `server/lib/mongodb.ts`:
```typescript
mongoClient = new MongoClient(MONGODB_URL, {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 10000,
  tls: true,
  tlsAllowInvalidCertificates: true, // ⚠️ Dev only!
});
```

### Fix 2: Use Standard Connection String
Instead of `mongodb+srv://`, try standard connection:

```env
MONGODB_URI=mongodb://studybuddy5512_db_user:Iwillbe@ac-a4jo8y7-shard-00-00.rwlwl7d.mongodb.net:27017,ac-a4jo8y7-shard-00-01.rwlwl7d.mongodb.net:27017,ac-a4jo8y7-shard-00-02.rwlwl7d.mongodb.net:27017/studybuddy?ssl=true&replicaSet=atlas-gtrabf-shard-0&authSource=admin&retryWrites=true&w=majority
```

Get this from MongoDB Atlas:
1. Click **Connect** on your cluster
2. Choose **Connect your application**
3. Select **Driver: Node.js**
4. Copy the connection string

---

## 📋 Checklist

Before trying other solutions, verify:

- [ ] MongoDB Atlas cluster is running (not paused)
- [ ] IP address is whitelisted in Network Access
- [ ] Database user credentials are correct
- [ ] User has proper permissions
- [ ] `.env` file is loaded (restart server after changes)
- [ ] No firewall blocking MongoDB ports
- [ ] Internet connection is stable

---

## 🔄 Recommended Solution Path

1. **First**: Try the updated code (already applied)
2. **If fails**: Check MongoDB Atlas configuration
3. **If still fails**: Downgrade to Node.js v20
4. **Last resort**: Use `tlsAllowInvalidCertificates: true` (dev only)

---

## 💡 Why This Happens

Node.js v22 introduced stricter TLS/SSL validation:
- More secure by default
- Rejects some older SSL certificates
- Requires explicit TLS configuration
- May conflict with MongoDB Atlas's SSL setup

MongoDB Atlas uses shared SSL certificates that Node.js v22 validates more strictly.

---

## ✅ Expected Result

After applying the fix, you should see:

```bash
🔄 Connecting to MongoDB...
✅ MongoDB connected
✅ MongoDB indexes created
✅ MongoDB ready as primary database
✅ Server running on http://localhost:3001
```

---

## 🆘 Still Not Working?

### Option 1: Create New MongoDB Cluster
1. Go to MongoDB Atlas
2. Create a new M0 (free) cluster
3. Create new database user
4. Whitelist your IP
5. Get new connection string
6. Update `.env` with new credentials

### Option 2: Use Local MongoDB
```bash
# Install MongoDB locally
# Ubuntu/Debian:
sudo apt-get install mongodb

# macOS:
brew install mongodb-community

# Start MongoDB
mongod

# Update .env
MONGODB_URI=mongodb://localhost:27017/studybuddy
```

### Option 3: Use MongoDB Docker
```bash
# Run MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Update .env
MONGODB_URI=mongodb://localhost:27017/studybuddy
```

---

## 📚 Additional Resources

- **MongoDB Node.js Driver Docs**: https://www.mongodb.com/docs/drivers/node/current/
- **Node.js TLS Documentation**: https://nodejs.org/api/tls.html
- **MongoDB Atlas Connection Guide**: https://www.mongodb.com/docs/atlas/troubleshoot-connection/
- **nvm Installation**: https://github.com/nvm-sh/nvm

---

## 🎯 Summary

The TLS error is caused by Node.js v22's stricter SSL requirements. The fix involves:
1. Explicitly configuring TLS in MongoDB client
2. Adding TLS parameters to connection string
3. Or downgrading to Node.js v20 (LTS)

**Restart your server after applying any changes!**
