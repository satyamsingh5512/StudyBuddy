/**
 * Middleware Usage Examples
 * File: server/middleware/examples.ts
 * 
 * Examples of how to use the various middleware in your routes
 */

import { Router } from 'express';
import { isAuthenticated, requireEmailVerified, requireOnboarded } from './auth';
import { requireRole, requirePermission, requireAnyPermission, requireAllPermissions } from './authorization';
import { advancedRateLimiter } from './advancedRateLimiting';
import { isAdmin, isSuperAdmin } from './admin';

const router = Router();

// ============================================================================
// AUTHENTICATION EXAMPLES
// ============================================================================

/**
 * Example 1: Basic authentication
 * Requires user to be logged in
 */
router.get('/profile', isAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

/**
 * Example 2: Email verification required
 * Requires user to be logged in AND have verified email
 */
router.get('/verified-only', isAuthenticated, requireEmailVerified, (req, res) => {
  res.json({ message: 'Email verified!' });
});

/**
 * Example 3: Onboarding required
 * Requires user to be logged in AND have completed onboarding
 */
router.get('/dashboard', isAuthenticated, requireOnboarded, (req, res) => {
  res.json({ message: 'Welcome to dashboard!' });
});

// ============================================================================
// AUTHORIZATION EXAMPLES
// ============================================================================

/**
 * Example 4: Role-based access
 * Only users with ADMIN or SUPER_ADMIN role can access
 */
router.get('/admin/users', isAuthenticated, requireRole(['ADMIN', 'SUPER_ADMIN']), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

/**
 * Example 5: Permission-based access
 * Only users with 'users:delete' permission can access
 */
router.delete('/users/:id', isAuthenticated, requirePermission('users:delete'), (req, res) => {
  res.json({ message: 'User deleted' });
});

/**
 * Example 6: Multiple permissions (ANY)
 * User needs at least ONE of the specified permissions
 */
router.get(
  '/content',
  isAuthenticated,
  requireAnyPermission(['content:read', 'content:write', 'content:admin']),
  (req, res) => {
    res.json({ message: 'Content access granted' });
  }
);

/**
 * Example 7: Multiple permissions (ALL)
 * User needs ALL of the specified permissions
 */
router.post(
  '/admin/settings',
  isAuthenticated,
  requireAllPermissions(['settings:read', 'settings:write']),
  (req, res) => {
    res.json({ message: 'Settings updated' });
  }
);

// ============================================================================
// RATE LIMITING EXAMPLES
// ============================================================================

/**
 * Example 8: Basic rate limiting
 * Different limits based on user tier
 */
router.post(
  '/api/generate',
  isAuthenticated,
  advancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limits: {
      FREE: 5, // 5 requests per minute
      PREMIUM: 20, // 20 requests per minute
      ENTERPRISE: 100, // 100 requests per minute
    },
  }),
  (req, res) => {
    res.json({ message: 'Generated!' });
  }
);

/**
 * Example 9: Strict rate limiting for sensitive operations
 */
router.post(
  '/auth/reset-password',
  advancedRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limits: {
      FREE: 3,
      PREMIUM: 3,
      ENTERPRISE: 3,
    },
  }),
  (req, res) => {
    res.json({ message: 'Password reset email sent' });
  }
);

// ============================================================================
// ADMIN MIDDLEWARE EXAMPLES
// ============================================================================

/**
 * Example 10: Admin-only route
 */
router.get('/admin/dashboard', isAuthenticated, isAdmin, (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

/**
 * Example 11: Super admin-only route
 */
router.post('/admin/system/config', isAuthenticated, isSuperAdmin, (req, res) => {
  res.json({ message: 'System config updated' });
});

// ============================================================================
// COMBINED MIDDLEWARE EXAMPLES
// ============================================================================

/**
 * Example 12: Multiple middleware combined
 * - Must be authenticated
 * - Must have verified email
 * - Must have completed onboarding
 * - Must have PREMIUM or ENTERPRISE tier
 * - Rate limited based on tier
 */
router.post(
  '/premium/feature',
  isAuthenticated,
  requireEmailVerified,
  requireOnboarded,
  requireRole(['PREMIUM', 'ENTERPRISE']),
  advancedRateLimiter({
    windowMs: 60 * 1000,
    limits: {
      FREE: 0, // Not allowed
      PREMIUM: 10,
      ENTERPRISE: 50,
    },
  }),
  (req, res) => {
    res.json({ message: 'Premium feature accessed' });
  }
);

/**
 * Example 13: Resource ownership check
 * User can only access their own resources
 */
router.get('/todos/:id', isAuthenticated, async (req, res) => {
  const todoId = req.params.id;
  const userId = (req.user as any).id;

  // Check ownership (this would be in your actual route handler)
  // const todo = await db.todo.findUnique({ where: { id: todoId } });
  // if (todo.userId !== userId) {
  //   return res.status(403).json({ error: 'Access denied' });
  // }

  res.json({ message: 'Todo retrieved' });
});

/**
 * Example 14: Conditional middleware
 * Apply different middleware based on conditions
 */
router.post('/content', isAuthenticated, (req, res, next) => {
  const user = req.user as any;

  // Apply stricter rate limiting for free users
  if (user.tier === 'FREE') {
    return advancedRateLimiter({
      windowMs: 60 * 1000,
      limits: { FREE: 5, PREMIUM: 5, ENTERPRISE: 5 },
    })(req, res, next);
  }

  next();
}, (req, res) => {
  res.json({ message: 'Content created' });
});

export default router;
