"use strict";
/**
 * Token Bucket Rate Limiter
 * File: server/lib/rateLimiter.ts
 *
 * In-memory rate limiter with Redis fallback support.
 * Uses token bucket algorithm for smooth rate limiting.
 *
 * For Redis (production):
 * npm install ioredis
 *
 * Usage:
 *   import { rateLimiter, socketRateLimiter } from './lib/rateLimiter';
 *   app.use('/api/', rateLimiter({ maxRequests: 100, windowMs: 60000 }));
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketRateLimiter = exports.rateLimiter = void 0;
// In-memory store (replace with Redis for multi-instance)
const buckets = new Map();
// Cleanup old buckets every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now - bucket.lastRefill > 300000) { // 5 minutes
            buckets.delete(key);
        }
    }
}, 300000);
const getTokenBucket = (key, config) => {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { tokens: config.maxRequests, lastRefill: now };
        buckets.set(key, bucket);
        return bucket;
    }
    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / config.windowMs) * config.maxRequests;
    bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    return bucket;
};
const rateLimiter = (config) => {
    const { maxRequests = 100, windowMs = 60000, keyGenerator = (req) => req.ip || 'unknown', message = 'Too many requests, please try again later', } = config;
    return (req, res, next) => {
        const key = `api:${keyGenerator(req)}`;
        const bucket = getTokenBucket(key, { maxRequests, windowMs });
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));
            res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);
            next();
        }
        else {
            res.status(429).json({
                error: message,
                retryAfter: Math.ceil(windowMs / 1000),
            });
        }
    };
};
exports.rateLimiter = rateLimiter;
const socketRateLimiter = (config) => {
    const { maxMessages = 10, windowMs = 10000 } = config;
    return (socketId, userId) => {
        const key = `socket:${userId}:${socketId}`;
        const bucket = getTokenBucket(key, { maxRequests: maxMessages, windowMs });
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true };
        }
        return {
            allowed: false,
            retryAfter: Math.ceil(windowMs / 1000)
        };
    };
};
exports.socketRateLimiter = socketRateLimiter;
// Redis-based rate limiter (for horizontal scaling)
// Uncomment and configure when using Redis
/*
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local max_requests = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  
  local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
  local tokens = tonumber(bucket[1]) or max_requests
  local lastRefill = tonumber(bucket[2]) or now
  
  local timePassed = now - lastRefill
  local tokensToAdd = (timePassed / window_ms) * max_requests
  tokens = math.min(max_requests, tokens + tokensToAdd)
  
  if tokens >= 1 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
    redis.call('PEXPIRE', key, window_ms * 2)
    return {1, tokens}
  else
    return {0, tokens}
  end
`;

export const redisRateLimiter = async (
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> => {
  const result = await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    key,
    maxRequests,
    windowMs,
    Date.now()
  ) as [number, number];
  
  return {
    allowed: result[0] === 1,
    remaining: Math.floor(result[1]),
  };
};
*/
exports.default = exports.rateLimiter;
