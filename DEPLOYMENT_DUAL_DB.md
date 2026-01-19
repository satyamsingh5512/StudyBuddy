# Dual Database Deployment Guide

## Pre-Deployment Checklist

- [ ] CockroachDB connection tested
- [ ] MongoDB connection tested
- [ ] Outbox migration ready
- [ ] Sync worker tested locally
- [ ] Health endpoints working
- [ ] Backup plan in place

---

## Step 1: Database Migration

### 1.1 Run Outbox Migration

```bash
# Generate Prisma client with Outbox model
npx prisma generate

# Deploy migration to CockroachDB
npx prisma migrate deploy

# Verify migration
npx prisma studio
# Check that "Outbox" table exists
```

### 1.2 Verify Indexes

```sql
-- Connect to CockroachDB
cockroach sql --url="<DATABASE_URL>"

-- Check indexes
SHOW INDEXES FROM "Outbox";

-- Expected indexes:
-- - Outbox_processed_created_at_idx
-- - Outbox_aggregate_type_aggregate_id_idx
-- - Outbox_event_type_idx
```

---

## Step 2: Deploy Updated API

### 2.1 Build Application

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Test server locally
npm run start:server
```

### 2.2 Deploy to Production

```bash
# Using PM2
pm2 stop api
pm2 start npm --name "api" -- run start:server
pm2 save

# Using Docker
docker build -t studybuddy-api .
docker run -d --name api -p 3001:3001 studybuddy-api

# Using Render/Vercel
git push origin main
# Auto-deploys via CI/CD
```

### 2.3 Verify API Health

```bash
# Check basic health
curl https://your-api.com/health

# Check sync status
curl https://your-api.com/api/health/sync

# Expected response:
# {
#   "status": "healthy",
#   "databases": {
#     "cockroachdb": "connected",
#     "mongodb": "connected"
#   },
#   "sync": {
#     "queueSize": 0,
#     "syncLagSeconds": 0
#   }
# }
```

---

## Step 3: Start Sync Worker

### 3.1 Run Worker Process

```bash
# Using PM2 (recommended)
pm2 start npm --name "sync-worker" -- run worker:sync
pm2 save

# Using Docker
docker run -d --name sync-worker studybuddy-worker

# Using systemd
sudo systemctl start studybuddy-worker
```

### 3.2 Monitor Worker Logs

```bash
# PM2
pm2 logs sync-worker

# Docker
docker logs -f sync-worker

# Expected output:
# 🚀 Sync worker started
#    Poll interval: 2000ms
#    Batch size: 100
# ✅ Synced todos/abc123 (45ms)
# ✅ Synced users/xyz789 (32ms)
```

---

## Step 4: Verify Data Sync

### 4.1 Create Test Data

```bash
# Create a todo via API
curl -X POST https://your-api.com/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Test sync","subject":"Math","difficulty":"easy","questionsTarget":10}'
```

### 4.2 Check CockroachDB

```sql
-- Check todo exists
SELECT * FROM "Todo" WHERE title = 'Test sync';

-- Check outbox event created
SELECT * FROM "Outbox" 
WHERE event_type = 'todo.created' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 4.3 Check MongoDB (after 2-5 seconds)

```javascript
// Connect to MongoDB
mongosh "<MONGODB_URL>"

// Check todo synced
db.todos.findOne({ title: "Test sync" })

// Should see:
// {
//   _id: ObjectId("..."),
//   _originalId: "abc123",
//   title: "Test sync",
//   _syncedAt: ISODate("2026-01-19T..."),
//   _source: "cockroachdb"
// }
```

### 4.4 Check Outbox Processed

```sql
-- Verify event marked as processed
SELECT * FROM "Outbox" 
WHERE event_type = 'todo.created' 
AND processed = true
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Step 5: Monitor Production

### 5.1 Set Up Monitoring

```bash
# Health check endpoint
curl https://your-api.com/api/health/sync

# Key metrics to monitor:
# - syncLagSeconds (target: < 5s, alert: > 30s)
# - queueSize (target: < 1000, alert: > 10000)
# - failedEvents (target: < 10, alert: > 100)
```

### 5.2 Set Up Alerts

```yaml
# Example: Prometheus + Alertmanager
alerts:
  - name: SyncLagHigh
    expr: sync_lag_seconds > 30
    severity: warning
    
  - name: SyncLagCritical
    expr: sync_lag_seconds > 60
    severity: critical
    
  - name: QueueSizeHigh
    expr: outbox_queue_size > 10000
    severity: critical
```

### 5.3 Dashboard Metrics

Monitor these in Grafana/Datadog:
- API response time (P50, P95, P99)
- Outbox queue size
- Sync lag
- MongoDB query time
- CockroachDB query time
- Worker throughput (events/sec)

---

## Step 6: Performance Validation

### 6.1 Benchmark API Latency

```bash
# Before (with synchronous dual writes)
ab -n 1000 -c 10 https://your-api.com/api/todos
# Time per request: ~1200ms

# After (with outbox pattern)
ab -n 1000 -c 10 https://your-api.com/api/todos
# Time per request: ~150ms
# Improvement: 87% faster
```

### 6.2 Verify Read Performance

```bash
# Leaderboard from MongoDB
curl https://your-api.com/api/users/leaderboard -w "%{time_total}\n"
# Expected: < 100ms

# Analytics from MongoDB
curl https://your-api.com/api/reports/analytics -w "%{time_total}\n"
# Expected: < 200ms
```

---

## Rollback Plan

If issues occur, follow these steps:

### Option 1: Stop Worker Only

```bash
# Stop sync worker
pm2 stop sync-worker

# API continues working
# MongoDB becomes stale but no data loss
# Events accumulate in outbox
```

### Option 2: Full Rollback

```bash
# 1. Stop worker
pm2 stop sync-worker

# 2. Revert API to previous version
git revert <commit-hash>
npm run build
pm2 restart api

# 3. Run full backup to MongoDB
curl -X POST https://your-api.com/api/backup/full

# 4. Verify data consistency
npm run verify:sync
```

---

## Troubleshooting

### Issue: Sync lag increasing

**Symptoms**: `syncLagSeconds` > 30

**Causes**:
- MongoDB slow/overloaded
- Worker crashed
- Network issues

**Solutions**:
```bash
# Check worker status
pm2 status sync-worker

# Restart worker
pm2 restart sync-worker

# Check MongoDB performance
mongosh --eval "db.currentOp()"

# Scale worker (run multiple instances)
pm2 scale sync-worker 3
```

### Issue: Queue size growing

**Symptoms**: `queueSize` > 10,000

**Causes**:
- Worker too slow
- MongoDB down
- High write volume

**Solutions**:
```bash
# Increase batch size
# Edit server/workers/syncWorker.ts
# Change BATCH_SIZE from 100 to 500

# Run multiple workers
pm2 scale sync-worker 5

# Check failed events
SELECT * FROM "Outbox" 
WHERE processed = false 
AND retry_count > 5
ORDER BY created_at ASC;
```

### Issue: Data inconsistency

**Symptoms**: Data in CockroachDB but not MongoDB

**Causes**:
- Worker not running
- MongoDB connection failed
- Outbox events not created

**Solutions**:
```bash
# Check outbox for unprocessed events
SELECT COUNT(*) FROM "Outbox" WHERE processed = false;

# Manually trigger sync
curl -X POST https://your-api.com/api/admin/sync/trigger

# Run full backup
curl -X POST https://your-api.com/api/backup/full
```

---

## Maintenance

### Daily Tasks

```bash
# Check sync health
curl https://your-api.com/api/health/sync

# Monitor worker logs
pm2 logs sync-worker --lines 100
```

### Weekly Tasks

```bash
# Check outbox table size
SELECT COUNT(*) FROM "Outbox";

# Clean up old events (automatic, but verify)
SELECT COUNT(*) FROM "Outbox" 
WHERE processed = true 
AND processed_at < NOW() - INTERVAL '7 days';
```

### Monthly Tasks

```bash
# Review failed events
SELECT event_type, COUNT(*), MAX(retry_count)
FROM "Outbox"
WHERE processed = false
GROUP BY event_type;

# Optimize MongoDB indexes
mongosh --eval "db.todos.getIndexes()"
mongosh --eval "db.todos.stats()"
```

---

## Production Checklist

- [ ] Outbox migration deployed
- [ ] API deployed and healthy
- [ ] Sync worker running
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Backup tested
- [ ] Rollback plan documented
- [ ] Team trained on new architecture
- [ ] Performance benchmarks validated

---

## Support

For issues or questions:
1. Check logs: `pm2 logs`
2. Check health: `curl /api/health/sync`
3. Review this guide
4. Contact DevOps team
