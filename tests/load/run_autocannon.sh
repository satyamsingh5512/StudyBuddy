#!/bin/bash
# Load Testing Script with Autocannon
# File: tests/load/run_autocannon.sh
#
# Install: npm install -g autocannon
# Usage: ./tests/load/run_autocannon.sh [environment]
#
# Environments:
#   local - http://localhost:3001
#   staging - your staging URL
#   prod - your production URL (use with caution!)

set -e

# Configuration
ENV=${1:-local}
DURATION=30
CONNECTIONS=50
PIPELINING=10

case $ENV in
  local)
    BASE_URL="http://localhost:3001"
    ;;
  staging)
    BASE_URL="https://your-staging-url.vercel.app"
    ;;
  prod)
    BASE_URL="https://your-prod-url.vercel.app"
    echo "⚠️  WARNING: Running against production!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
    ;;
  *)
    echo "Unknown environment: $ENV"
    exit 1
    ;;
esac

echo "🚀 Starting load tests against $BASE_URL"
echo "Duration: ${DURATION}s, Connections: $CONNECTIONS, Pipelining: $PIPELINING"
echo ""

# Create results directory
mkdir -p tests/load/results

# Health check first
echo "📋 Health Check..."
curl -s "$BASE_URL/api/health" | jq . || echo "Health check failed"
echo ""

# Test 1: Health endpoint (baseline)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test 1: Health Endpoint (Baseline)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
autocannon \
  -c $CONNECTIONS \
  -d $DURATION \
  -p $PIPELINING \
  --json \
  "$BASE_URL/api/health" \
  | tee tests/load/results/health_$(date +%Y%m%d_%H%M%S).json \
  | jq '{
    url: .url,
    requests: .requests.total,
    throughput: .throughput.average,
    latency_avg: .latency.average,
    latency_p50: .latency.p50,
    latency_p95: .latency.p95,
    latency_p99: .latency.p99,
    errors: .errors
  }'

echo ""

# Test 2: Leaderboard (read-heavy, public)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test 2: Leaderboard Endpoint (Read-Heavy)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Note: This will fail auth, but tests the route handling
autocannon \
  -c $CONNECTIONS \
  -d $DURATION \
  -p $PIPELINING \
  --json \
  "$BASE_URL/api/users/leaderboard" \
  | tee tests/load/results/leaderboard_$(date +%Y%m%d_%H%M%S).json \
  | jq '{
    url: .url,
    requests: .requests.total,
    throughput: .throughput.average,
    latency_avg: .latency.average,
    latency_p50: .latency.p50,
    latency_p95: .latency.p95,
    latency_p99: .latency.p99,
    errors: .errors,
    "2xx": .statusCodeStats["200"] // 0,
    "4xx": (.statusCodeStats["401"] // 0) + (.statusCodeStats["403"] // 0)
  }'

echo ""

# Test 3: Concurrent mixed load
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test 3: Mixed Endpoints (Concurrent)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run multiple endpoints concurrently
(
  autocannon -c 20 -d $DURATION "$BASE_URL/api/health" --json > tests/load/results/mixed_health.json &
  autocannon -c 20 -d $DURATION "$BASE_URL/api/users/leaderboard" --json > tests/load/results/mixed_leaderboard.json &
  wait
)

echo "Mixed load test complete. Results in tests/load/results/"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Target SLOs:"
echo "  - p95 latency < 200ms for reads"
echo "  - p95 latency < 500ms for writes"
echo "  - Error rate < 1%"
echo "  - Throughput > 100 RPS on free tier"
echo ""
echo "Results saved to: tests/load/results/"
echo ""

# Interpretation guide
cat << 'EOF'
📖 How to interpret results:

1. latency.average - Mean response time (lower is better)
2. latency.p95 - 95th percentile (95% of requests faster than this)
3. latency.p99 - 99th percentile (tail latency)
4. throughput.average - Requests per second
5. errors - Connection/timeout errors (should be 0)

🎯 Targets for Vercel:
- Health: p95 < 50ms, throughput > 500 RPS
- Reads: p95 < 200ms, throughput > 100 RPS  
- Writes: p95 < 500ms, throughput > 50 RPS

⚠️  If p95 > 1000ms, check:
1. Database indexes (run EXPLAIN ANALYZE)
2. N+1 queries (check timing middleware logs)
3. Cold starts (first request after idle)
EOF
