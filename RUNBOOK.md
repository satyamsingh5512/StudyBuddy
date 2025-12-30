# StudyBuddy Performance Runbook

## Quick Reference

### Emergency Commands

```bash
# Check server health
curl https://your-backend.onrender.com/api/health | jq .

# Check metrics
curl https://your-backend.onrender.com/metrics

# Restart on Render (via dashboard or CLI)
render services restart srv-xxxxx

# Rollback database migration
npx prisma migrate resolve --rolled-back "001_add_indexes"
```

---

## 1. Pre-Deployment Checklist

### Before Deploying Performance Fixes

- [ ] All tests passing locally
- [ ] Database backup completed
- [ ] Monitoring dashboard accessible
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

### Environment Verification

```bash
# Verify Prisma client is singleton
grep -r "new PrismaClient" server/routes/ 
# Should return 0 results after fix

# Verify indexes exist
npx prisma db execute --file infra/migrations/001_add_indexes.sql --preview

# Run load test baseline
./tests/load/run_autocannon.sh local
```

---

## 2. Deployment Steps

### Phase 1: Database Indexes (Low Risk)

**Duration:** 5-10 minutes  
**Risk:** Low (indexes created concurrently)

```bash
# 1. Create indexes (non-blocking)
npx prisma db execute --file infra/migrations/001_add_indexes.sql

# 2. Verify indexes
cockroach sql --url $DATABASE_URL -e "SHOW INDEXES FROM \"DirectMessage\";"

# 3. Monitor for 10 minutes
# Watch for increased latency during index build
```

**Rollback:**
```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_direct_message_conversation;
DROP INDEX CONCURRENTLY IF EXISTS idx_direct_message_unread;
-- ... repeat for other indexes
```

### Phase 2: Prisma Singleton (Low Risk)

**Duration:** 2 minutes  
**Risk:** Low

```bash
# 1. Deploy server/lib/prisma.ts

# 2. Update all route imports:
# FROM: const prisma = new PrismaClient();
# TO:   import prisma from '../lib/prisma';

# 3. Deploy and verify
curl https://your-backend.onrender.com/api/health
```

**Rollback:** Revert git commit

### Phase 3: Optimized Routes (Medium Risk)

**Duration:** 15 minutes  
**Risk:** Medium (logic changes)

```bash
# 1. Deploy optimized routes one at a time:
#    - friends.optimized.ts → friends.ts
#    - messages.optimized.ts → messages.ts

# 2. Test each endpoint manually
curl -X GET https://your-backend.onrender.com/api/friends/list \
  -H "Cookie: your-session-cookie"

# 3. Monitor error rates for 15 minutes
```

**Rollback:** `git checkout HEAD~1 -- server/routes/friends.ts`

### Phase 4: Socket.IO Optimizations (Medium Risk)

**Duration:** 10 minutes  
**Risk:** Medium (real-time features)

```bash
# 1. Deploy handlers.optimized.ts → handlers.ts

# 2. Test WebSocket connectivity
node tests/ws/ws_bench.js https://your-backend.onrender.com 10 10

# 3. Monitor chat functionality manually
```

**Rollback:** `git checkout HEAD~1 -- server/socket/handlers.ts`

### Phase 5: Frontend Optimizations (Low Risk)

**Duration:** 5 minutes  
**Risk:** Low (client-side only)

```bash
# 1. Deploy new atoms and components

# 2. Verify build succeeds
npm run build

# 3. Test in browser with React DevTools
# Check for reduced re-renders
```

---

## 3. Canary Deployment Plan

### 5% Rollout

```bash
# Using feature flags (add to .env)
PERF_OPTIMIZATIONS_ENABLED=5

# In code:
const useOptimizedRoute = Math.random() * 100 < parseInt(process.env.PERF_OPTIMIZATIONS_ENABLED || '0');
```

**Monitor for 30 minutes:**
- Error rate < 1%
- p95 latency improved or stable
- No user complaints

### 25% Rollout

```bash
PERF_OPTIMIZATIONS_ENABLED=25
```

**Monitor for 1 hour:**
- Same criteria as above
- Check database connection pool usage

### 100% Rollout

```bash
PERF_OPTIMIZATIONS_ENABLED=100
# Or remove feature flag entirely
```

---

## 4. Monitoring & Alerts

### Key Metrics to Watch

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| p95 Latency | > 500ms | > 1000ms | Check slow query logs |
| Error Rate | > 1% | > 5% | Rollback immediately |
| DB Connections | > 80% | > 95% | Scale or optimize |
| Memory Usage | > 80% | > 95% | Restart service |
| Socket Connections | > 1000 | > 2000 | Enable Redis adapter |

### Grafana Dashboard Panels

1. **Request Latency** - p50, p95, p99 over time
2. **Throughput** - Requests per second
3. **Error Rate** - 4xx and 5xx responses
4. **Database** - Query duration, connection pool
5. **WebSocket** - Active connections, messages/sec

### Alert Rules

```yaml
# Prometheus alerting rules
groups:
  - name: studybuddy
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High p95 latency detected"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate above 1%"
```

---

## 5. Troubleshooting

### High Latency

```bash
# 1. Check slow queries
# Add to timing middleware logs, look for > 500ms

# 2. Check database
cockroach sql --url $DATABASE_URL -e "SHOW QUERIES;"

# 3. Check for N+1 queries
# Look for repeated similar queries in logs

# 4. Verify indexes are being used
EXPLAIN ANALYZE SELECT * FROM "DirectMessage" 
WHERE "senderId" = 'xxx' AND "receiverId" = 'yyy' 
ORDER BY "createdAt" DESC LIMIT 50;
```

### Connection Pool Exhaustion

```bash
# 1. Check current connections
cockroach sql --url $DATABASE_URL -e "SHOW SESSIONS;"

# 2. Verify singleton pattern
grep -r "new PrismaClient" server/

# 3. Increase pool size (temporary)
# Add to DATABASE_URL: ?connection_limit=20
```

### WebSocket Issues

```bash
# 1. Check active connections
curl https://your-backend.onrender.com/metrics | grep active_websocket

# 2. Test connectivity
node tests/ws/ws_bench.js https://your-backend.onrender.com 5 10

# 3. Check rate limiting
# Look for 'rate-limit' events in client console
```

### Memory Issues

```bash
# 1. Check memory usage
curl https://your-backend.onrender.com/api/health | jq .memory

# 2. Look for memory leaks
# - Multiple PrismaClient instances
# - Unbounded caches
# - Event listener leaks

# 3. Restart service
# Via Render dashboard
```

---

## 6. Load Testing Commands

### Quick Smoke Test

```bash
# 10 connections, 10 seconds
autocannon -c 10 -d 10 https://your-backend.onrender.com/api/health
```

### Full Load Test

```bash
# Run complete test suite
./tests/load/run_autocannon.sh staging
```

### WebSocket Load Test

```bash
# 50 connections, 30 seconds
node tests/ws/ws_bench.js https://your-backend.onrender.com 50 30
```

### Stress Test (Use with Caution)

```bash
# Find breaking point
autocannon -c 500 -d 60 https://your-backend.onrender.com/api/health
```

---

## 7. Rollback Procedures

### Quick Rollback (Git)

```bash
# Revert last commit
git revert HEAD
git push origin main

# Render will auto-deploy
```

### Database Rollback

```bash
# List migrations
npx prisma migrate status

# Rollback specific migration
npx prisma migrate resolve --rolled-back "migration_name"

# Drop indexes manually if needed
cockroach sql --url $DATABASE_URL < infra/rollback/drop_indexes.sql
```

### Feature Flag Disable

```bash
# Set to 0 to disable all optimizations
PERF_OPTIMIZATIONS_ENABLED=0

# Restart service
```

---

## 8. Post-Deployment Verification

### Checklist

- [ ] Health endpoint returns 200
- [ ] Login flow works
- [ ] Task CRUD operations work
- [ ] Chat messages send/receive
- [ ] Friend requests work
- [ ] Leaderboard loads
- [ ] Analytics dashboard loads
- [ ] No increase in error rate
- [ ] Latency improved or stable

### Verification Commands

```bash
# Health check
curl -s https://your-backend.onrender.com/api/health | jq .

# Metrics check
curl -s https://your-backend.onrender.com/metrics | head -50

# Load test comparison
./tests/load/run_autocannon.sh staging
# Compare with baseline results
```

---

## 9. Contact & Escalation

### On-Call

- Primary: [Your Name]
- Secondary: [Team Member]
- Escalation: [Tech Lead]

### Communication

- Slack: #studybuddy-alerts
- Status Page: status.studybuddy.com

### External Dependencies

- Render Status: status.render.com
- CockroachDB Status: status.cockroachlabs.cloud
- Vercel Status: vercel.com/status
