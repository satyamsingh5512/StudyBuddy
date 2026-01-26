"use strict";
/**
 * Middleware Index
 * File: server/middleware/index.ts
 *
 * Central export point for all middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.middleware = exports.getClientIP = exports.bodySizeGuard = exports.securityHeaders = exports.removeFromBlacklist = exports.addToBlacklist = exports.removeFromWhitelist = exports.addToWhitelist = exports.generousRateLimiter = exports.moderateRateLimiter = exports.strictRateLimiter = exports.createAdvancedRateLimiter = exports.globalRateLimiter = exports.reportRateLimiter = exports.friendRequestRateLimiter = exports.messageRateLimiter = exports.apiRateLimiter = exports.uploadRateLimiter = exports.newsRateLimiter = exports.aiRateLimiter = exports.authRateLimiter = exports.checkIsAdmin = exports.isAdmin = exports.checkPermission = exports.getUserPermissions = exports.canAccessResource = exports.requireModerator = exports.requireAdmin = exports.hasAnyPermission = exports.hasPermission = exports.hasRole = exports.Permission = exports.UserRole = exports.attachUserInfo = exports.isOwner = exports.requireOnboarding = exports.requireEmailVerified = exports.optionalAuth = exports.isAuthenticated = void 0;
// Authentication
var auth_1 = require("./auth");
Object.defineProperty(exports, "isAuthenticated", { enumerable: true, get: function () { return auth_1.isAuthenticated; } });
Object.defineProperty(exports, "optionalAuth", { enumerable: true, get: function () { return auth_1.optionalAuth; } });
Object.defineProperty(exports, "requireEmailVerified", { enumerable: true, get: function () { return auth_1.requireEmailVerified; } });
Object.defineProperty(exports, "requireOnboarding", { enumerable: true, get: function () { return auth_1.requireOnboarding; } });
Object.defineProperty(exports, "isOwner", { enumerable: true, get: function () { return auth_1.isOwner; } });
Object.defineProperty(exports, "attachUserInfo", { enumerable: true, get: function () { return auth_1.attachUserInfo; } });
// Authorization
var authorization_1 = require("./authorization");
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return authorization_1.UserRole; } });
Object.defineProperty(exports, "Permission", { enumerable: true, get: function () { return authorization_1.Permission; } });
Object.defineProperty(exports, "hasRole", { enumerable: true, get: function () { return authorization_1.hasRole; } });
Object.defineProperty(exports, "hasPermission", { enumerable: true, get: function () { return authorization_1.hasPermission; } });
Object.defineProperty(exports, "hasAnyPermission", { enumerable: true, get: function () { return authorization_1.hasAnyPermission; } });
Object.defineProperty(exports, "requireAdmin", { enumerable: true, get: function () { return authorization_1.requireAdmin; } });
Object.defineProperty(exports, "requireModerator", { enumerable: true, get: function () { return authorization_1.requireModerator; } });
Object.defineProperty(exports, "canAccessResource", { enumerable: true, get: function () { return authorization_1.canAccessResource; } });
Object.defineProperty(exports, "getUserPermissions", { enumerable: true, get: function () { return authorization_1.getUserPermissions; } });
Object.defineProperty(exports, "checkPermission", { enumerable: true, get: function () { return authorization_1.checkPermission; } });
// Admin
var admin_1 = require("./admin");
Object.defineProperty(exports, "isAdmin", { enumerable: true, get: function () { return admin_1.isAdmin; } });
Object.defineProperty(exports, "checkIsAdmin", { enumerable: true, get: function () { return admin_1.checkIsAdmin; } });
// Rate Limiting (original)
var rateLimiting_1 = require("./rateLimiting");
Object.defineProperty(exports, "authRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.authRateLimiter; } });
Object.defineProperty(exports, "aiRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.aiRateLimiter; } });
Object.defineProperty(exports, "newsRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.newsRateLimiter; } });
Object.defineProperty(exports, "uploadRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.uploadRateLimiter; } });
Object.defineProperty(exports, "apiRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.apiRateLimiter; } });
Object.defineProperty(exports, "messageRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.messageRateLimiter; } });
Object.defineProperty(exports, "friendRequestRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.friendRequestRateLimiter; } });
Object.defineProperty(exports, "reportRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.reportRateLimiter; } });
Object.defineProperty(exports, "globalRateLimiter", { enumerable: true, get: function () { return rateLimiting_1.globalRateLimiter; } });
// Advanced Rate Limiting
var advancedRateLimiting_1 = require("./advancedRateLimiting");
Object.defineProperty(exports, "createAdvancedRateLimiter", { enumerable: true, get: function () { return advancedRateLimiting_1.createAdvancedRateLimiter; } });
Object.defineProperty(exports, "strictRateLimiter", { enumerable: true, get: function () { return advancedRateLimiting_1.strictRateLimiter; } });
Object.defineProperty(exports, "moderateRateLimiter", { enumerable: true, get: function () { return advancedRateLimiting_1.moderateRateLimiter; } });
Object.defineProperty(exports, "generousRateLimiter", { enumerable: true, get: function () { return advancedRateLimiting_1.generousRateLimiter; } });
Object.defineProperty(exports, "addToWhitelist", { enumerable: true, get: function () { return advancedRateLimiting_1.addToWhitelist; } });
Object.defineProperty(exports, "removeFromWhitelist", { enumerable: true, get: function () { return advancedRateLimiting_1.removeFromWhitelist; } });
Object.defineProperty(exports, "addToBlacklist", { enumerable: true, get: function () { return advancedRateLimiting_1.addToBlacklist; } });
Object.defineProperty(exports, "removeFromBlacklist", { enumerable: true, get: function () { return advancedRateLimiting_1.removeFromBlacklist; } });
// Security
var security_1 = require("./security");
Object.defineProperty(exports, "securityHeaders", { enumerable: true, get: function () { return security_1.securityHeaders; } });
Object.defineProperty(exports, "bodySizeGuard", { enumerable: true, get: function () { return security_1.bodySizeGuard; } });
Object.defineProperty(exports, "getClientIP", { enumerable: true, get: function () { return security_1.getClientIP; } });
/**
 * Quick access to commonly used middleware
 */
exports.middleware = {
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
exports.default = exports.middleware;
