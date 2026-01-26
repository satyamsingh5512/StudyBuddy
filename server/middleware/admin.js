"use strict";
/**
 * Admin Middleware
 * File: server/middleware/admin.ts
 *
 * Middleware to check if user has admin privileges
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
exports.isSuperAdmin = isSuperAdmin;
/**
 * Check if user is an admin
 */
function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const user = req.user;
    // Check if user has admin role
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
/**
 * Check if user is a super admin
 */
function isSuperAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const user = req.user;
    // Check if user has super admin role
    if (user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
}
exports.default = { isAdmin, isSuperAdmin };
