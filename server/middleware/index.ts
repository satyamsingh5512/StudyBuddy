/**
 * Middleware Index
 * File: server/middleware/index.ts
 *
 * Central export point for all middleware
 */

import * as auth from './auth.js';
import * as rateLimiting from './rateLimiting.js';
import * as security from './security.js';
import * as admin from './admin.js';

// Authentication
export {
  isAuthenticated,
  optionalAuth,
  requireEmailVerified,
  requireOnboarding,
  isOwner,
  attachUserInfo,
} from './auth';

// Admin
export { isAdmin, isSuperAdmin } from './admin';

// Rate Limiting (original)
export {
  authRateLimiter,
  aiRateLimiter,
  newsRateLimiter,
  uploadRateLimiter,
  apiRateLimiter,
  messageRateLimiter,
  friendRequestRateLimiter,
  reportRateLimiter,
  globalRateLimiter,
} from './rateLimiting';

// Security
export { securityHeaders, bodySizeGuard, getClientIP } from './security';

/**
 * Quick access to commonly used middleware
 */
export const middleware = {
  // Authentication
  isAuthenticated: auth.isAuthenticated,
  requireEmailVerified: auth.requireEmailVerified,
  requireOnboarding: auth.requireOnboarding,

  // Rate Limiting
  authRateLimiter: rateLimiting.authRateLimiter,
  aiRateLimiter: rateLimiting.aiRateLimiter,
  apiRateLimiter: rateLimiting.apiRateLimiter,

  // Security
  securityHeaders: security.securityHeaders,
  bodySizeGuard: security.bodySizeGuard,

  // Admin
  isAdmin: admin.isAdmin,
};

export default middleware;
