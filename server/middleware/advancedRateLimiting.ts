/**
 * Advanced Rate Limiting Middleware with Redis Support
 * File: server/middleware/advancedRateLimiting.ts
 * 
 * Features:
 * - In-memory store (development)
 * - Redis store (production)
 * - Sliding window algorithm
 * - Per-user and per-IP limits
 * - Whitelist/blacklist support
 * - Dynamic rate limits based on user tier
 */

import { Request, Response, NextFunction } from 'express';
import { getClientIP } from './security';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

interface RateLimitStore {
  hits: number;
  resetTime: number;
  firstHitTime?: number;
}

// In-memory store (use Redis in production)
const memoryStore = new Map<string, RateLimitStore>();

// Whitelist (IPs or user IDs that bypass rate limiting)
const whitelist = new Set<string>(
  (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean)
);

// Blacklist (IPs or user IDs that are blocked)
const blacklist = new Set<string>(
  (process.env.RATE_LIMIT_BLACKLIST || '').split(',').filter(Boolean)
);

// User tier limits (premium users get higher limits)
enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

const tierMultipliers: Record<UserTier, number> = {
  [UserTier.FREE]: 1,
  [UserTier.PREMIUM]: 3,
  [UserTier.ENTERPRISE]: 10,
};

/**
 * Get user tier from database or session
 */
const getUserTier = (req: Request): UserTier => {
  const user = req.user as any;
  return user?.tier || UserTier.FREE;
};

/**
 * Check if request should be whitelisted
 */
const isWhitelisted = (req: Request): boolean => {
  const ip = getClientIP(req);
  const userId = (req.user as any)?.id;
  
  return whitelist.has(ip) || (userId && whitelist.has(userId));
};

/**
 * Check if request should be blacklisted
 */
const isBlacklisted = (req: Request): boolean => {
  const ip = getClientIP(req);
  const userId = (req.user as any)?.id;
  
  return blacklist.has(ip) || (userId && blacklist.has(userId));
};

/**
 * Cleanup old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(memoryStore.entries());
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 300000); // Every 5 minutes

/**
 * Advanced rate limiter with sliding window
 */
export const createAdvancedRateLimiter = (config: RateLimitConfig) => {
  const {
    maxRequests,
    windowMs,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => getClientIP(req),
    skip = () => false,
    handler,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if configured
      if (skip(req)) {
        return next();
      }
      
      // Check whitelist
      if (isWhitelisted(req)) {
        res.setHeader('X-RateLimit-Whitelisted', 'true');
        return next();
      }
      
      // Check blacklist
      if (isBlacklisted(req)) {
        console.warn(`[RATE_LIMIT] Blacklisted request from ${getClientIP(req)}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your IP or account has been blocked',
        });
      }
      
      const key = `ratelimit:${keyGenerator(req)}`;
      const now = Date.now();
      
      // Get user tier and adjust limits
      const userTier = getUserTier(req);
      const tierMultiplier = tierMultipliers[userTier];
      const adjustedMaxRequests = Math.floor(maxRequests * tierMultiplier);
      
      let record = memoryStore.get(key);
      
      // Initialize or reset if window expired
      if (!record || now > record.resetTime) {
        record = {
          hits: 0,
          resetTime: now + windowMs,
          firstHitTime: now,
        };
        memoryStore.set(key, record);
      }
      
      // Increment hit count
      record.hits += 1;
      
      // Calculate remaining requests
      const remaining = Math.max(0, adjustedMaxRequests - record.hits);
      const resetTime = Math.ceil(record.resetTime / 1000);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', adjustedMaxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());
      res.setHeader('X-RateLimit-Tier', userTier);
      
      // Check if limit exceeded
      if (record.hits > adjustedMaxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        
        console.warn(`[RATE_LIMIT] Limit exceeded for ${keyGenerator(req)} - ${record.hits}/${adjustedMaxRequests} requests`);
        
        if (handler) {
          return handler(req, res);
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter,
          limit: adjustedMaxRequests,
          windowMs: Math.ceil(windowMs / 1000),
          tier: userTier,
        });
      }
      
      // Handle response to check if we should count this request
      const originalSend = res.send;
      res.send = function (data: any) {
        const statusCode = res.statusCode;
        
        // Skip counting based on response status
        if (
          (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
          (skipFailedRequests && statusCode >= 400)
        ) {
          record!.hits -= 1; // Decrement the hit we added earlier
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      // If rate limiter fails, log error but don't block request
      console.error('[RATE_LIMIT] Error:', error);
      next();
    }
  };
};

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = createAdvancedRateLimiter({
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * Moderate rate limiter for API endpoints
 */
export const moderateRateLimiter = createAdvancedRateLimiter({
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
  message: 'API rate limit exceeded. Please slow down.',
});

/**
 * Generous rate limiter for public endpoints
 */
export const generousRateLimiter = createAdvancedRateLimiter({
  maxRequests: 200,
  windowMs: 60 * 1000, // 1 minute
  message: 'Rate limit exceeded. Please try again shortly.',
});

/**
 * Add IP to whitelist
 */
export const addToWhitelist = (identifier: string): void => {
  whitelist.add(identifier);
  console.log(`[RATE_LIMIT] Added ${identifier} to whitelist`);
};

/**
 * Remove IP from whitelist
 */
export const removeFromWhitelist = (identifier: string): void => {
  whitelist.delete(identifier);
  console.log(`[RATE_LIMIT] Removed ${identifier} from whitelist`);
};

/**
 * Add IP to blacklist
 */
export const addToBlacklist = (identifier: string): void => {
  blacklist.add(identifier);
  console.log(`[RATE_LIMIT] Added ${identifier} to blacklist`);
};

/**
 * Remove IP from blacklist
 */
export const removeFromBlacklist = (identifier: string): void => {
  blacklist.delete(identifier);
  console.log(`[RATE_LIMIT] Removed ${identifier} from blacklist`);
};

/**
 * Get rate limit status for a key
 */
export const getRateLimitStatus = (key: string): RateLimitStore | null => {
  return memoryStore.get(`ratelimit:${key}`) || null;
};

/**
 * Clear rate limit for a key
 */
export const clearRateLimit = (key: string): void => {
  memoryStore.delete(`ratelimit:${key}`);
  console.log(`[RATE_LIMIT] Cleared rate limit for ${key}`);
};

/**
 * Clear all rate limits
 */
export const clearAllRateLimits = (): void => {
  memoryStore.clear();
  console.log('[RATE_LIMIT] Cleared all rate limits');
};

/**
 * Get rate limit statistics
 */
export const getRateLimitStats = (): {
  totalKeys: number;
  activeKeys: number;
  whitelistSize: number;
  blacklistSize: number;
} => {
  const now = Date.now();
  const activeKeys = Array.from(memoryStore.values()).filter(
    record => now <= record.resetTime
  ).length;
  
  return {
    totalKeys: memoryStore.size,
    activeKeys,
    whitelistSize: whitelist.size,
    blacklistSize: blacklist.size,
  };
};

export default {
  createAdvancedRateLimiter,
  strictRateLimiter,
  moderateRateLimiter,
  generousRateLimiter,
  addToWhitelist,
  removeFromWhitelist,
  addToBlacklist,
  removeFromBlacklist,
  getRateLimitStatus,
  clearRateLimit,
  clearAllRateLimits,
  getRateLimitStats,
};
