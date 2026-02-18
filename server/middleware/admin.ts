/**
 * Admin Middleware
 * File: server/middleware/admin.ts
 *
 * Middleware to check if user has admin privileges.
 * Must be used AFTER isAuthenticated middleware (which sets req.user via JWT).
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Check if user is an admin
 * Assumes isAuthenticated middleware has already run and set req.user
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  const adminEmail = process.env.ADMIN_EMAIL;

  // Check if user email matches admin email from env
  if (adminEmail && user.email === adminEmail) {
    return next();
  }

  // Check if user has admin role
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail && user.email === adminEmail) {
    return next();
  }

  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
}

export default { isAdmin, isSuperAdmin };
