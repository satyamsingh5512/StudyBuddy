package cache

// Shared-response cache for the free-tier stack:
// Azure App Service F1 (1GB RAM) + MongoDB Atlas M0 (512MB) +
// tiny Redis free tier (~20MB, few connections, daily command caps).
//
// Design rules for a 20MB Redis shared with realtime Streams:
//   - Cache ONLY shared/public responses (leaderboard, notices, FAQs).
//     Never per-user keys: they explode key count and evict everything.
//   - Small values only (guarded by maxValueBytes). Large payloads
//     (news body is already in-memory cached, journal attachments,
//     avatars) must NOT go here.
//   - Short TTLs + best-effort semantics: every error (OOM, timeout,
//     eviction, disabled) falls back to MongoDB. Cache never fails
//     a request.
//   - Tiny connection pool: free Redis tiers cap concurrent clients.

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// TTLs tuned for tiny Redis: hot shared data stays fresh enough
	// while keeping write volume (free command caps) low.
	TTLLeaderboard = 120 * time.Second
	TTLNotices     = 600 * time.Second
	TTLFAQs        = 600 * time.Second

	// Keys. Single leaderboard key, single notices key, one per examType.
	KeyLeaderboard = "sb:v1:leaderboard"
	KeyNotices     = "sb:v1:notices"
	FAQsKeyPrefix  = "sb:v1:faqs:"

	// Guards for the 20MB budget.
	maxValueBytes = 64 * 1024 // skip caching anything larger than 64KB
	opTimeout     = 1500 * time.Millisecond
)

var (
	mu     sync.RWMutex
	client *redis.Client
)

func disabledByEnv() bool {
	v := strings.TrimSpace(os.Getenv("CACHE_DISABLED"))
	return v == "1" || strings.EqualFold(v, "true")
}

// Configure connects the cache client. Empty REDIS_URL or any failure
// leaves the cache disabled; callers fall back to MongoDB.
func Configure(ctx context.Context, rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		log.Println("Query cache disabled (REDIS_URL is not configured)")
		return nil
	}
	if disabledByEnv() {
		log.Println("Query cache disabled (CACHE_DISABLED=1)")
		return nil
	}
	opts, err := redis.ParseURL(rawURL)
	if err != nil {
		return err
	}
	// Free Redis tiers cap connections: keep the pool tiny.
	opts.PoolSize = 5
	opts.MinIdleConns = 1
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = opTimeout
	opts.WriteTimeout = opTimeout

	c := redis.NewClient(opts)
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := c.Ping(pingCtx).Err(); err != nil {
		_ = c.Close()
		return err
	}

	mu.Lock()
	prev := client
	client = c
	mu.Unlock()
	if prev != nil {
		_ = prev.Close()
	}
	log.Println("Query cache enabled (shared responses only, 20MB-safe)")
	return nil
}

func current() *redis.Client {
	mu.RLock()
	defer mu.RUnlock()
	return client
}

// Enabled reports whether query caching is active.
func Enabled() bool { return current() != nil }

// Close releases the cache client.
func Close() {
	mu.Lock()
	c := client
	client = nil
	mu.Unlock()
	if c != nil {
		_ = c.Close()
	}
}

// FAQsKey returns the cache key for an examType FAQ list.
func FAQsKey(examType string) string {
	examType = strings.TrimSpace(examType)
	if examType == "" {
		examType = "all"
	}
	return FAQsKeyPrefix + examType
}

// GetJSON loads a cached JSON value into dest. Returns false on
// miss or any error (callers must query MongoDB).
func GetJSON(ctx context.Context, key string, dest any) bool {
	c := current()
	if c == nil || key == "" || dest == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	raw, err := c.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	if len(raw) == 0 || len(raw) > maxValueBytes {
		return false
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		return false
	}
	return true
}

// SetJSON stores value with TTL. Best-effort: oversized values,
// OOM/eviction errors, and timeouts are silently skipped so the
// request path never fails because of the cache.
func SetJSON(ctx context.Context, key string, value any, ttl time.Duration) {
	c := current()
	if c == nil || key == "" || value == nil || ttl <= 0 {
		return
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return
	}
	if len(raw) == 0 || len(raw) > maxValueBytes {
		// Protect the 20MB budget: never store large payloads.
		return
	}
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	// OOM on tiny tiers surfaces as an error here; ignore it and
	// let the next request re-fill after TTL/expiry frees space.
	_ = c.Set(ctx, key, raw, ttl).Err()
}

// Del removes keys (e.g. admin-triggered invalidation). Best-effort.
func Del(ctx context.Context, keys ...string) {
	c := current()
	if c == nil || len(keys) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	_ = c.Del(ctx, keys...).Err()
}
