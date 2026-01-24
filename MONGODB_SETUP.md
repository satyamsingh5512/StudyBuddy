# MongoDB Setup Guide

## Current Issue

The MongoDB connection is failing with authentication error. This means the credentials in your `.env` file are incorrect or expired.

## Quick Fix

### Option 1: Create a New MongoDB Atlas Cluster (Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign in or create a free account
3. Create a new cluster (Free tier is fine)
4. Click "Connect" on your cluster
5. Choose "Connect your application"
6. Copy the connection string
7. Replace the connection string in `.env`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/studybuddy?retryWrites=true&w=majority
```

**Important:** Replace `<username>`, `<password>`, and `<cluster>` with your actual values!

### Option 2: Update Existing Credentials

If you have an existing MongoDB Atlas account:

1. Go to MongoDB Atlas Dashboard
2. Click "Database Access" in the left sidebar
3. Check if user `satyamsingh5512` exists
4. If not, create a new database user:
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Set username and password
   - Grant "Read and write to any database" role
5. Update `.env` with the new credentials

### Option 3: Whitelist Your IP Address

MongoDB Atlas requires your IP address to be whitelisted:

1. Go to MongoDB Atlas Dashboard
2. Click "Network Access" in the left sidebar
3. Click "Add IP Address"
4. Choose "Add Current IP Address" or "Allow Access from Anywhere" (0.0.0.0/0)
5. Click "Confirm"

## Testing the Connection

After updating your `.env` file:

1. Stop the server (Ctrl+C)
2. Restart the server:
   ```bash
   npm run dev:server
   ```
3. Look for this message:
   ```
   ✅ MongoDB connected
   ✅ MongoDB ready as primary database
   ```

## Common Errors

### Error: "bad auth : authentication failed"
- **Cause:** Wrong username or password
- **Fix:** Update MONGODB_URI with correct credentials

### Error: "ENOTFOUND"
- **Cause:** Wrong cluster URL
- **Fix:** Copy the correct connection string from MongoDB Atlas

### Error: "IP not whitelisted"
- **Cause:** Your IP address is not allowed
- **Fix:** Add your IP to Network Access in MongoDB Atlas

## Example .env Configuration

```env
# MongoDB (Primary Database)
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/studybuddy?retryWrites=true&w=majority

# Session Secret
SESSION_SECRET=my-super-secret-session-key-change-this

# SMTP Configuration (for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Client URL
CLIENT_URL=http://localhost:5173

# Server Port
PORT=3001
NODE_ENV=development
```

## Need Help?

If you continue to have issues:

1. Check the server logs for specific error messages
2. Verify your MongoDB Atlas cluster is running
3. Test the connection string using MongoDB Compass
4. Make sure you're using the correct database name (studybuddy)

## Alternative: Use Local MongoDB

If you prefer to use a local MongoDB instance:

1. Install MongoDB locally
2. Start MongoDB service
3. Update `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/studybuddy
   ```

This avoids authentication issues but requires MongoDB to be installed on your machine.
