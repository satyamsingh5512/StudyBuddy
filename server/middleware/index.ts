/**
 * Middleware Index
 * File: server/middleware/index.ts
 * 
 * Central export point for all middleware
 */

// Authentication
export {
  isAuthenticated,
  optionalAuth,
  requireEmailVerified,
  requireOnboarding,
  isOwner,
  attachUserInfo,
} from './auth';

// Authorization
export {
  UserRole,
  Permission,
  hasRole,
  hasPermission,
  hasAnyPermission,
  requireAdmin,
  requireModerator,
  canAccessResource,
  getUserPermissions,
  checkPermission,
} from './authorization';

// Admin
export { isAdmin, checkIsAdmin } from './admin';

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

// Advanced Rate Limiting
export {
  createAdvancedRateLimiter,
  strictRateLimiter,
  moderateRateLimiter,
  generousRateLimiter,
  addToWhitelist,
  removeFromWhitelist,
  addToBlacklist,
  removeFromBlacklist,
} from './advancedRateLimiting';

// Security
export { securityHeaders, bodySizeGuard, getClientIP } from './security';

/**
 * Quick access to commonly used middleware
 */
export const middleware = {
  // Authentication
  isAuthenticated: require('./auth').isAuthenticated,
  requireEmailVerified: require('./auth').requireEmailVerified,
  requireOnboarding: require('./auth').requireOnboarding,
  
  // Authorization
  requireAdmin: require('./authorization').requireAdmin,
  requireModerator: require('./authorization').requireModerator,
  hasRole: require('./authorization').hasRole,
  hasPermission: require('./authorization').hasPermission,
  
  // Rate Limiting
  authRateLimiter: require('./rateLimiting').authRateLimiter,
  aiRateLimiter: require('./rateLimiting').aiRateLimiter,
  apiRateLimiter: require('./rateLimiting').apiRateLimiter,
  
  // Advanced Rate Limiting
  strictRateLimiter: require('./advancedRateLimiting').strictRateLimiter,
  moderateRateLimiter: require('./advancedRateLimiting').moderateRateLimiter,
  generousRateLimiter: require('./advancedRateLimiting').generousRateLimiter,
  
  // Security
  securityHeaders: require('./security').securityHeaders,
  bodySizeGuard: require('./security').bodySizeGuard,
  
  // Admin
  isAdmin: require('./admin').isAdmin,
};

export default middleware;
