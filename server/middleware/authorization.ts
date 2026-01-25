/**
 * Role-Based Authorization Middleware
 * File: server/middleware/authorization.ts
 * 
 * Provides role-based access control (RBAC) for protected routes.
 * Supports multiple roles and permissions.
 */

import { Request, Response, NextFunction } from 'express';

// Define user roles
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// Define permissions
export enum Permission {
  // User permissions
  READ_OWN_DATA = 'read:own',
  WRITE_OWN_DATA = 'write:own',
  DELETE_OWN_DATA = 'delete:own',
  
  // Moderator permissions
  READ_ALL_DATA = 'read:all',
  MODERATE_CONTENT = 'moderate:content',
  BAN_USERS = 'ban:users',
  
  // Admin permissions
  WRITE_ALL_DATA = 'write:all',
  DELETE_ALL_DATA = 'delete:all',
  MANAGE_USERS = 'manage:users',
  VIEW_ANALYTICS = 'view:analytics',
  
  // Super admin permissions
  MANAGE_ADMINS = 'manage:admins',
  SYSTEM_CONFIG = 'system:config',
}

// Role to permissions mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.READ_OWN_DATA,
    Permission.WRITE_OWN_DATA,
    Permission.DELETE_OWN_DATA,
  ],
  [UserRole.MODERATOR]: [
    Permission.READ_OWN_DATA,
    Permission.WRITE_OWN_DATA,
    Permission.DELETE_OWN_DATA,
    Permission.READ_ALL_DATA,
    Permission.MODERATE_CONTENT,
    Permission.BAN_USERS,
  ],
  [UserRole.ADMIN]: [
    Permission.READ_OWN_DATA,
    Permission.WRITE_OWN_DATA,
    Permission.DELETE_OWN_DATA,
    Permission.READ_ALL_DATA,
    Permission.MODERATE_CONTENT,
    Permission.BAN_USERS,
    Permission.WRITE_ALL_DATA,
    Permission.DELETE_ALL_DATA,
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
};

/**
 * Get user role from database or session
 * In production, this should query the database
 */
const getUserRole = (req: Request): UserRole => {
  const user = req.user as any;
  
  // Check if user has role in session
  if (user?.role) {
    return user.role as UserRole;
  }
  
  // Check environment variable for admin users
  const adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);
  if (user?.id && adminUserIds.includes(user.id)) {
    return UserRole.ADMIN;
  }
  
  // Default to user role
  return UserRole.USER;
};

/**
 * Check if user has specific role
 */
export const hasRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRole = getUserRole(req);
    
    if (!roles.includes(userRole)) {
      console.warn(`[AUTHZ] User ${(req.user as any)?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (requires: ${roles.join(', ')})`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: roles,
        current: userRole,
      });
    }
    
    next();
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (...permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRole = getUserRole(req);
    const userPermissions = rolePermissions[userRole] || [];
    
    const hasAllPermissions = permissions.every(p => userPermissions.includes(p));
    
    if (!hasAllPermissions) {
      console.warn(`[AUTHZ] User ${(req.user as any)?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (missing permissions: ${permissions.join(', ')})`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: permissions,
      });
    }
    
    next();
  };
};

/**
 * Check if user has ANY of the specified permissions
 */
export const hasAnyPermission = (...permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRole = getUserRole(req);
    const userPermissions = rolePermissions[userRole] || [];
    
    const hasAnyPerm = permissions.some(p => userPermissions.includes(p));
    
    if (!hasAnyPerm) {
      console.warn(`[AUTHZ] User ${(req.user as any)?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (requires any of: ${permissions.join(', ')})`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: permissions,
      });
    }
    
    next();
  };
};

/**
 * Require admin role
 */
export const requireAdmin = hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

/**
 * Require moderator role or higher
 */
export const requireModerator = hasRole(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN);

/**
 * Check if user can access resource
 * Either owns the resource OR has admin permissions
 */
export const canAccessResource = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const currentUserId = (req.user as any).id;
  const resourceUserId = req.params.userId || req.body.userId;
  const userRole = getUserRole(req);
  
  // Allow if user owns resource OR is admin
  if (currentUserId === resourceUserId || [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(userRole)) {
    return next();
  }
  
  console.warn(`[AUTHZ] User ${currentUserId} (${userRole}) attempted to access resource owned by ${resourceUserId}`);
  return res.status(403).json({ 
    error: 'Forbidden',
    message: 'You do not have permission to access this resource'
  });
};

/**
 * Get user permissions
 */
export const getUserPermissions = (req: Request): Permission[] => {
  if (!req.isAuthenticated()) {
    return [];
  }
  
  const userRole = getUserRole(req);
  return rolePermissions[userRole] || [];
};

/**
 * Check if user has permission (utility function)
 */
export const checkPermission = (req: Request, permission: Permission): boolean => {
  const permissions = getUserPermissions(req);
  return permissions.includes(permission);
};

export default {
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
};
