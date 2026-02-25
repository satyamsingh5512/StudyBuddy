/**
 * Advanced Rate Limiting Middleware
 * File: server/middleware/rateLimiting.ts
 *
 * Provides tiered rate limiting for different endpoint types:
 * - Strict limits for auth endpoints (prevent brute force)
 * - Moderate limits for AI endpoints (prevent abuse)
 * - Generous limits for general API (normal usage)
 * - Special limits for expensive operations
 */


import { Request, Response, NextFunction } from 'express';
import { getClientIP } from './security.js';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitStore {
  hits: number;
  resetTime: number;
}

// In-memory store (use Redis in production for multi-instance)
const store = new Map<string, RateLimitStore>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(store.entries());
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 300000);

/**
 * Core rate limiter function
 */
const createRateLimiter = (config: RateLimitConfig) => {
  const {
    maxRequests,
    windowMs,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => getClientIP(req),
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `ratelimit:${keyGenerator(req)}`;
      const now = Date.now();

      let record = store.get(key);

      // Initialize or reset if window expired
      if (!record || now > record.resetTime) {
        record = {
          hits: 0,
          resetTime: now + windowMs,
        };
        store.set(key, record);
      }

      // Increment hit count
      record.hits += 1;

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - record.hits);
      const resetTime = Math.ceil(record.resetTime / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());

      // Check if limit exceeded
      if (record.hits > maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        return res.status(429).json({
          error: message,
          retryAfter,
          limit: maxRequests,
          windowMs: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      // If rate limiter fails, log error but don't block request
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

/**
 * Auth endpoints rate limiter (strict)
 * Prevents brute force attacks on login/signup
 */
export const authRateLimiter = createRateLimiter({
  maxRequests: 5,           // 5 attempts
  windowMs: 15 * 60 * 1000, // per 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => `auth:${getClientIP(req)}`,
});

/**
 * AI endpoints rate limiter (moderate)
 * Prevents abuse of expensive AI operations
 */
export const aiRateLimiter = createRateLimiter({
  maxRequests: 30,          // 30 requests
  windowMs: 60 * 1000,      // per minute
  message: 'AI request limit exceeded. Please wait a moment before trying again.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `ai:${userId}:${getClientIP(req)}`;
  },
});

/**
 * News endpoints rate limiter (moderate)
 * Prevents excessive news API calls
 */
export const newsRateLimiter = createRateLimiter({
  maxRequests: 20,          // 20 requests
  windowMs: 60 * 1000,      // per minute
  message: 'News request limit exceeded. Please try again shortly.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `news:${userId}:${getClientIP(req)}`;
  },
});

/**
 * Upload endpoints rate limiter (strict)
 * Prevents abuse of file upload
 */
export const uploadRateLimiter = createRateLimiter({
  maxRequests: 10,          // 10 uploads
  windowMs: 60 * 60 * 1000, // per hour
  message: 'Upload limit exceeded. Please try again later.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `upload:${userId}:${getClientIP(req)}`;
  },
});

/**
 * General API rate limiter (generous)
 * For normal CRUD operations
 */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 100,         // 100 requests
  windowMs: 60 * 1000,      // per minute
  message: 'API rate limit exceeded. Please slow down.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `api:${userId}:${getClientIP(req)}`;
  },
});

/**
 * Message/Chat rate limiter (moderate)
 * Prevents spam in chat
 */
export const messageRateLimiter = createRateLimiter({
  maxRequests: 30,          // 30 messages
  windowMs: 60 * 1000,      // per minute
  message: 'Message rate limit exceeded. Please slow down.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `message:${userId}`;
  },
});

/**
 * Friend request rate limiter (strict)
 * Prevents spam friend requests
 */
export const friendRequestRateLimiter = createRateLimiter({
  maxRequests: 10,          // 10 requests
  windowMs: 60 * 60 * 1000, // per hour
  message: 'Friend request limit exceeded. Please try again later.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `friend:${userId}`;
  },
});

/**
 * Report generation rate limiter (moderate)
 * Prevents excessive report generation
 */
export const reportRateLimiter = createRateLimiter({
  maxRequests: 20,          // 20 reports
  windowMs: 60 * 60 * 1000, // per hour
  message: 'Report generation limit exceeded. Please try again later.',
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id || 'anonymous';
    return `report:${userId}`;
  },
});

/**
 * Global rate limiter (very generous)
 * Catches all other endpoints
 */
export const globalRateLimiter = createRateLimiter({
  maxRequests: 200,         // 200 requests
  windowMs: 60 * 1000,      // per minute
  message: 'Global rate limit exceeded. Please slow down.',
  keyGenerator: (req) => getClientIP(req),
});

/**
 * Get current rate limit status for a user
 */
export const getRateLimitStatus = (userId: string, type: string = 'api'): {
  remaining: number;
  resetTime: number;
  limit: number;
} | null => {
  const key = `ratelimit:${type}:${userId}`;
  const record = store.get(key);

  if (!record) {
    return null;
  }

  const limits: Record<string, number> = {
    auth: 5,
    ai: 10,
    news: 20,
    upload: 10,
    api: 100,
    message: 30,
    friend: 10,
    report: 20,
    global: 200,
  };

  const limit = limits[type] || 100;

  return {
    remaining: Math.max(0, limit - record.hits),
    resetTime: record.resetTime,
    limit,
  };
};

/**
 * Clear rate limit for a specific user (admin function)
 */
export const clearRateLimit = (userId: string, type?: string): void => {
  if (type) {
    const key = `ratelimit:${type}:${userId}`;
    store.delete(key);
  } else {
    // Clear all rate limits for user
    const keys = Array.from(store.keys());
    for (const key of keys) {
      if (key.includes(userId)) {
        store.delete(key);
      }
    }
  }
};

export default {
  authRateLimiter,
  aiRateLimiter,
  newsRateLimiter,
  uploadRateLimiter,
  apiRateLimiter,
  messageRateLimiter,
  friendRequestRateLimiter,
  reportRateLimiter,
  globalRateLimiter,
  getRateLimitStatus,
  clearRateLimit,
};
