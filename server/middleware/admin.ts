/**
 * Admin Middleware
 * File: server/middleware/admin.ts
 *
 * Middleware to check if user has admin privileges
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Check if user is an admin
 * Admin can be determined by:
 * 1. User role is ADMIN or SUPER_ADMIN
 * 2. User email matches ADMIN_EMAIL from environment
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
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
 * Super admin can be determined by:
 * 1. User role is SUPER_ADMIN
 * 2. User email matches ADMIN_EMAIL from environment
 */
export function isSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  const adminEmail = process.env.ADMIN_EMAIL;

  // Check if user email matches admin email from env
  if (adminEmail && user.email === adminEmail) {
    return next();
  }

  // Check if user has super admin role
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
}

export default { isAdmin, isSuperAdmin };
