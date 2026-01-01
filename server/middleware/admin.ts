/**
 * Admin Authorization Middleware
 * File: server/middleware/admin.ts
 * 
 * Checks if authenticated user has admin privileges.
 * Admin user IDs are configured via ADMIN_USER_IDS environment variable.
 */

import { Request, Response, NextFunction } from 'express';

// Admin user IDs - comma-separated list in env
// In production, consider storing admin status in database
const ADMIN_USER_IDS = new Set(
  (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean)
);

/**
 * Middleware to verify admin access
 * Must be used after isAuthenticated middleware
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const userId = (req.user as any)?.id;
  
  if (!userId || !ADMIN_USER_IDS.has(userId)) {
    console.warn(`[SECURITY] Non-admin user ${userId} attempted admin action: ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

/**
 * Check if a user ID has admin privileges
 */
export const checkIsAdmin = (userId: string): boolean => {
  return ADMIN_USER_IDS.has(userId);
};

export default isAdmin;
