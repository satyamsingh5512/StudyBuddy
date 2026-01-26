"use strict";
/**
 * Role-Based Authorization Middleware
 * File: server/middleware/authorization.ts
 *
 * Provides role-based access control (RBAC) for protected routes.
 * Supports multiple roles and permissions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.getUserPermissions = exports.canAccessResource = exports.requireModerator = exports.requireAdmin = exports.hasAnyPermission = exports.hasPermission = exports.hasRole = exports.Permission = exports.UserRole = void 0;
// Define user roles
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["MODERATOR"] = "moderator";
    UserRole["ADMIN"] = "admin";
    UserRole["SUPER_ADMIN"] = "super_admin";
})(UserRole || (exports.UserRole = UserRole = {}));
// Define permissions
var Permission;
(function (Permission) {
    // User permissions
    Permission["READ_OWN_DATA"] = "read:own";
    Permission["WRITE_OWN_DATA"] = "write:own";
    Permission["DELETE_OWN_DATA"] = "delete:own";
    // Moderator permissions
    Permission["READ_ALL_DATA"] = "read:all";
    Permission["MODERATE_CONTENT"] = "moderate:content";
    Permission["BAN_USERS"] = "ban:users";
    // Admin permissions
    Permission["WRITE_ALL_DATA"] = "write:all";
    Permission["DELETE_ALL_DATA"] = "delete:all";
    Permission["MANAGE_USERS"] = "manage:users";
    Permission["VIEW_ANALYTICS"] = "view:analytics";
    // Super admin permissions
    Permission["MANAGE_ADMINS"] = "manage:admins";
    Permission["SYSTEM_CONFIG"] = "system:config";
})(Permission || (exports.Permission = Permission = {}));
// Role to permissions mapping
const rolePermissions = {
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
const getUserRole = (req) => {
    const user = req.user;
    // Check if user has role in session
    if (user?.role) {
        return user.role;
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
const hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }
        const userRole = getUserRole(req);
        if (!roles.includes(userRole)) {
            console.warn(`[AUTHZ] User ${req.user?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (requires: ${roles.join(', ')})`);
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
exports.hasRole = hasRole;
/**
 * Check if user has specific permission
 */
const hasPermission = (...permissions) => {
    return (req, res, next) => {
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
            console.warn(`[AUTHZ] User ${req.user?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (missing permissions: ${permissions.join(', ')})`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions',
                required: permissions,
            });
        }
        next();
    };
};
exports.hasPermission = hasPermission;
/**
 * Check if user has ANY of the specified permissions
 */
const hasAnyPermission = (...permissions) => {
    return (req, res, next) => {
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
            console.warn(`[AUTHZ] User ${req.user?.id} with role ${userRole} attempted to access ${req.method} ${req.path} (requires any of: ${permissions.join(', ')})`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions',
                required: permissions,
            });
        }
        next();
    };
};
exports.hasAnyPermission = hasAnyPermission;
/**
 * Require admin role
 */
exports.requireAdmin = (0, exports.hasRole)(UserRole.ADMIN, UserRole.SUPER_ADMIN);
/**
 * Require moderator role or higher
 */
exports.requireModerator = (0, exports.hasRole)(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN);
/**
 * Check if user can access resource
 * Either owns the resource OR has admin permissions
 */
const canAccessResource = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUserId = req.user.id;
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
exports.canAccessResource = canAccessResource;
/**
 * Get user permissions
 */
const getUserPermissions = (req) => {
    if (!req.isAuthenticated()) {
        return [];
    }
    const userRole = getUserRole(req);
    return rolePermissions[userRole] || [];
};
exports.getUserPermissions = getUserPermissions;
/**
 * Check if user has permission (utility function)
 */
const checkPermission = (req, permission) => {
    const permissions = (0, exports.getUserPermissions)(req);
    return permissions.includes(permission);
};
exports.checkPermission = checkPermission;
exports.default = {
    UserRole,
    Permission,
    hasRole: exports.hasRole,
    hasPermission: exports.hasPermission,
    hasAnyPermission: exports.hasAnyPermission,
    requireAdmin: exports.requireAdmin,
    requireModerator: exports.requireModerator,
    canAccessResource: exports.canAccessResource,
    getUserPermissions: exports.getUserPermissions,
    checkPermission: exports.checkPermission,
};
