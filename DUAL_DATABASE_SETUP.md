# Dual Database Setup Guide
## CockroachDB (Primary) + MongoDB (Backup)

This setup gives you:
- ✅ **Zero data loss** during migrations
- ✅ **Automatic backups** to MongoDB every 24 hours
- ✅ **Database-agnostic** exports (JSON format)
- ✅ **Easy migration** between SQL/NoSQL databases

---

## Architecture

```
┌─────────────────┐
│   Your App      │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
    ┌────▼─────┐      ┌────▼────────┐
    │CockroachDB│      │  MongoDB    │
    │ (Primary) │──────▶│  (Backup)   │
    │  10GB Free│ Sync │ 512MB Free  │
    └───────────┘      └─────────────┘
```

---

## Step 1: Setup CockroachDB (Already Done! ✅)

Your CockroachDB is already configured and working.

---

## Step 2: Setup MongoDB Atlas (5 minutes)

### Create Free MongoDB Cluster:

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up / Login
3. Click **"Build a Database"**
4. Select **"M0 FREE"** tier
5. Choose **AWS** and region close to you
6. Click **"Create"**

### Get Connection String:

1. Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/studybuddy?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password

### Update .env:

```env
MONGODB_BACKUP_URL="mongodb+srv://your-user:your-password@cluster.mongodb.net/studybuddy?retryWrites=true&w=majority"
```

---

## Step 3: Install MongoDB Driver

```bash
npm install mongodb
```

---

## Step 4: Start Your Server

```bash
npm run dev
```

You should see:
```
✅ Database connected (CockroachDB)
✅ MongoDB backup connected
📅 Scheduling automatic backups every 24 hours
```

---

## Features

### 1. Automatic Backups

- Runs every 24 hours automatically
- Syncs all data from CockroachDB to MongoDB
- Stores backup metadata with timestamps

### 2. Manual Backup

Trigger a backup anytime:

```bash
curl -X POST http://localhost:3001/api/backup/now \
  -H "Cookie: your-session-cookie"
```

Or from your app's admin panel (to be built).

### 3. Export to JSON

Download database-agnostic JSON backup:

```bash
curl http://localhost:3001/api/backup/export \
  -H "Cookie: your-session-cookie" \
  -o backup.json
```

This JSON can be imported to **any database** (PostgreSQL, MySQL, MongoDB, etc.)

### 4. Real-time Sync (Optional)

To enable real-time sync on every write, wrap your Prisma operations:

```typescript
import { withMongoSync } from './middleware/mongoSync';

// Instead of:
await prisma.user.create({ data: userData });

// Use:
await withMongoSync(
  () => prisma.user.create({ data: userData }),
  'users',
  'create'
);
```

---

## Migration Scenarios

### Scenario 1: Migrate from CockroachDB to PostgreSQL

1. Export from MongoDB:
   ```bash
   curl http://localhost:3001/api/backup/export -o backup.json
   ```

2. Update `DATABASE_URL` to PostgreSQL

3. Run:
   ```bash
   npx prisma db push
   node import-from-json.js backup.json
   ```

### Scenario 2: Migrate from CockroachDB to MongoDB

1. MongoDB already has your data (from automatic backups!)

2. Update Prisma schema:
   ```prisma
   datasource db {
     provider = "mongodb"
     url      = env("MONGODB_BACKUP_URL")
   }
   ```

3. Update all models with `@map("_id") @db.ObjectId`

4. Run:
   ```bash
   npx prisma generate
   npm run dev
   ```

### Scenario 3: Migrate to MySQL/MariaDB

1. Export JSON backup

2. Update `DATABASE_URL` to MySQL

3. Run migration script (we'll create this if needed)

---

## Backup API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/backup/now` | POST | Trigger manual backup |
| `/api/backup/export` | GET | Download JSON backup |
| `/api/backup/status` | GET | Check backup status |
| `/api/backup/restore` | POST | Restore from MongoDB (careful!) |

---

## Environment Variables

### Production (Render):

Add to Render environment variables:

```
DATABASE_URL=your-cockroachdb-url
MONGODB_BACKUP_URL=your-mongodb-url
```

### Local Development:

Already in your `.env` file!

---

## Benefits

✅ **Zero Data Loss**: Always have a backup in MongoDB  
✅ **Database Freedom**: Migrate to any database anytime  
✅ **Disaster Recovery**: Restore from MongoDB if CockroachDB fails  
✅ **Cost Effective**: Both free tiers (10GB + 512MB)  
✅ **Automatic**: Set it and forget it  

---

## Monitoring

Check backup status:

```bash
curl http://localhost:3001/api/backup/status
```

Response:
```json
{
  "mongodbConnected": true,
  "lastBackup": "2024-12-23T10:00:00Z",
  "nextScheduledBackup": "2024-12-24T10:00:00Z",
  "backupInterval": "24 hours"
}
```

---

## Troubleshooting

### MongoDB Connection Failed

- Check your connection string
- Ensure IP whitelist includes `0.0.0.0/0` (allow all)
- Verify username/password

### Backup Not Running

- Check server logs for errors
- Verify `MONGODB_BACKUP_URL` is set
- Restart server

### Large Database

- MongoDB free tier: 512MB limit
- If you exceed, upgrade to M2 ($9/month) or use compression

---

## Next Steps

1. Set up MongoDB Atlas
2. Add `MONGODB_BACKUP_URL` to `.env`
3. Restart server
4. Verify backup is working
5. Add same env var to Render

Your data is now safe and portable! 🎉
