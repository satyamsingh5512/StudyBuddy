# CockroachDB Setup Guide

## Step 1: Create CockroachDB Account

1. Go to https://cockroachlabs.cloud/
2. Sign up with GitHub or email
3. Click "Create Cluster"

## Step 2: Configure Your Cluster

1. **Select Plan**: Choose "Serverless" (Free tier)
2. **Cloud Provider**: Choose any (AWS, GCP, or Azure)
3. **Region**: Select closest to your users
4. **Cluster Name**: `studybuddy` (or any name)
5. Click "Create cluster"

## Step 3: Get Connection String

1. After cluster creation, you'll see a connection dialog
2. **Select**: SQL User (create one if needed)
3. **Download CA Certificate**: Click "Download CA Cert" (optional for sslmode=require)
4. **Copy Connection String**: It looks like:
   ```
   postgresql://username:password@host.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
   ```

## Step 4: Update Your .env File

Replace the DATABASE_URL in your `.env` file:

```env
DATABASE_URL="postgresql://your-username:your-password@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
DIRECT_URL="postgresql://your-username:your-password@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
```

## Step 5: Push Schema to CockroachDB

```bash
npx prisma db push
npx prisma generate
```

## Step 6: (Optional) Import Data from Supabase

If you have data in Supabase:

1. Export from Supabase:
   ```bash
   node migrate-to-supabase.js
   ```

2. Update DATABASE_URL to CockroachDB

3. Import to CockroachDB:
   ```bash
   node import-to-supabase.js
   ```

## Step 7: Update Render Environment Variables

In Render Dashboard → Environment, update:

```
DATABASE_URL=postgresql://your-username:your-password@your-cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
```

Remove `DIRECT_URL` (not needed for CockroachDB)

## Step 8: Test Locally

```bash
npm run dev
```

Your app should now connect to CockroachDB!

## CockroachDB Free Tier Limits

- ✅ 10 GB storage
- ✅ Unlimited requests
- ✅ No pausing/sleeping
- ✅ Automatic backups
- ✅ Global distribution

## Troubleshooting

### Connection Error
- Make sure `sslmode=verify-full` or `sslmode=require` is in the URL
- Check if your IP is allowed (CockroachDB allows all by default)

### Schema Push Fails
- CockroachDB is PostgreSQL compatible but has some differences
- Our schema is fully compatible, no changes needed

### Performance
- CockroachDB Serverless has cold starts (~1-2 seconds)
- After warmup, it's very fast

## Benefits of CockroachDB

1. **No Pausing**: Unlike Neon, your database never sleeps
2. **Generous Free Tier**: 10GB is plenty for most apps
3. **Global Distribution**: Fast from anywhere
4. **PostgreSQL Compatible**: No code changes needed
5. **Automatic Scaling**: Handles traffic spikes automatically
