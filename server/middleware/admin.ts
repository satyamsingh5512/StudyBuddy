/**
 * Admin Middleware
 * File: server/middleware/admin.ts
 * 
 * Middleware to check if user has admin privileges
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Check if user is an admin
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  
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
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  
  // Check if user has super admin role
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
}

export default { isAdmin, isSuperAdmin };
