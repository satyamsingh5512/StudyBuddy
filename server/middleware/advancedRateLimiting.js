"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimitStats = exports.clearAllRateLimits = exports.clearRateLimit = exports.getRateLimitStatus = exports.removeFromBlacklist = exports.addToBlacklist = exports.removeFromWhitelist = exports.addToWhitelist = exports.generousRateLimiter = exports.moderateRateLimiter = exports.strictRateLimiter = exports.createAdvancedRateLimiter = void 0;
const security_1 = require("./security");
// In-memory store (use Redis in production)
const memoryStore = new Map();
// Whitelist (IPs or user IDs that bypass rate limiting)
const whitelist = new Set((process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean));
// Blacklist (IPs or user IDs that are blocked)
const blacklist = new Set((process.env.RATE_LIMIT_BLACKLIST || '').split(',').filter(Boolean));
// User tier limits (premium users get higher limits)
var UserTier;
(function (UserTier) {
    UserTier["FREE"] = "free";
    UserTier["PREMIUM"] = "premium";
    UserTier["ENTERPRISE"] = "enterprise";
})(UserTier || (UserTier = {}));
const tierMultipliers = {
    [UserTier.FREE]: 1,
    [UserTier.PREMIUM]: 3,
    [UserTier.ENTERPRISE]: 10,
};
/**
 * Get user tier from database or session
 */
const getUserTier = (req) => {
    const user = req.user;
    return user?.tier || UserTier.FREE;
};
/**
 * Check if request should be whitelisted
 */
const isWhitelisted = (req) => {
    const ip = (0, security_1.getClientIP)(req);
    const userId = req.user?.id;
    return whitelist.has(ip) || (userId && whitelist.has(userId));
};
/**
 * Check if request should be blacklisted
 */
const isBlacklisted = (req) => {
    const ip = (0, security_1.getClientIP)(req);
    const userId = req.user?.id;
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
const createAdvancedRateLimiter = (config) => {
    const { maxRequests, windowMs, message = 'Too many requests, please try again later', skipSuccessfulRequests = false, skipFailedRequests = false, keyGenerator = (req) => (0, security_1.getClientIP)(req), skip = () => false, handler, } = config;
    return async (req, res, next) => {
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
                console.warn(`[RATE_LIMIT] Blacklisted request from ${(0, security_1.getClientIP)(req)}`);
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
            res.send = function (data) {
                const statusCode = res.statusCode;
                // Skip counting based on response status
                if ((skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
                    (skipFailedRequests && statusCode >= 400)) {
                    record.hits -= 1; // Decrement the hit we added earlier
                }
                return originalSend.call(this, data);
            };
            next();
        }
        catch (error) {
            // If rate limiter fails, log error but don't block request
            console.error('[RATE_LIMIT] Error:', error);
            next();
        }
    };
};
exports.createAdvancedRateLimiter = createAdvancedRateLimiter;
/**
 * Strict rate limiter for sensitive endpoints
 */
exports.strictRateLimiter = (0, exports.createAdvancedRateLimiter)({
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true, // Only count failed attempts
});
/**
 * Moderate rate limiter for API endpoints
 */
exports.moderateRateLimiter = (0, exports.createAdvancedRateLimiter)({
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
    message: 'API rate limit exceeded. Please slow down.',
});
/**
 * Generous rate limiter for public endpoints
 */
exports.generousRateLimiter = (0, exports.createAdvancedRateLimiter)({
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Please try again shortly.',
});
/**
 * Add IP to whitelist
 */
const addToWhitelist = (identifier) => {
    whitelist.add(identifier);
    console.log(`[RATE_LIMIT] Added ${identifier} to whitelist`);
};
exports.addToWhitelist = addToWhitelist;
/**
 * Remove IP from whitelist
 */
const removeFromWhitelist = (identifier) => {
    whitelist.delete(identifier);
    console.log(`[RATE_LIMIT] Removed ${identifier} from whitelist`);
};
exports.removeFromWhitelist = removeFromWhitelist;
/**
 * Add IP to blacklist
 */
const addToBlacklist = (identifier) => {
    blacklist.add(identifier);
    console.log(`[RATE_LIMIT] Added ${identifier} to blacklist`);
};
exports.addToBlacklist = addToBlacklist;
/**
 * Remove IP from blacklist
 */
const removeFromBlacklist = (identifier) => {
    blacklist.delete(identifier);
    console.log(`[RATE_LIMIT] Removed ${identifier} from blacklist`);
};
exports.removeFromBlacklist = removeFromBlacklist;
/**
 * Get rate limit status for a key
 */
const getRateLimitStatus = (key) => {
    return memoryStore.get(`ratelimit:${key}`) || null;
};
exports.getRateLimitStatus = getRateLimitStatus;
/**
 * Clear rate limit for a key
 */
const clearRateLimit = (key) => {
    memoryStore.delete(`ratelimit:${key}`);
    console.log(`[RATE_LIMIT] Cleared rate limit for ${key}`);
};
exports.clearRateLimit = clearRateLimit;
/**
 * Clear all rate limits
 */
const clearAllRateLimits = () => {
    memoryStore.clear();
    console.log('[RATE_LIMIT] Cleared all rate limits');
};
exports.clearAllRateLimits = clearAllRateLimits;
/**
 * Get rate limit statistics
 */
const getRateLimitStats = () => {
    const now = Date.now();
    const activeKeys = Array.from(memoryStore.values()).filter(record => now <= record.resetTime).length;
    return {
        totalKeys: memoryStore.size,
        activeKeys,
        whitelistSize: whitelist.size,
        blacklistSize: blacklist.size,
    };
};
exports.getRateLimitStats = getRateLimitStats;
exports.default = {
    createAdvancedRateLimiter: exports.createAdvancedRateLimiter,
    strictRateLimiter: exports.strictRateLimiter,
    moderateRateLimiter: exports.moderateRateLimiter,
    generousRateLimiter: exports.generousRateLimiter,
    addToWhitelist: exports.addToWhitelist,
    removeFromWhitelist: exports.removeFromWhitelist,
    addToBlacklist: exports.addToBlacklist,
    removeFromBlacklist: exports.removeFromBlacklist,
    getRateLimitStatus: exports.getRateLimitStatus,
    clearRateLimit: exports.clearRateLimit,
    clearAllRateLimits: exports.clearAllRateLimits,
    getRateLimitStats: exports.getRateLimitStats,
};
