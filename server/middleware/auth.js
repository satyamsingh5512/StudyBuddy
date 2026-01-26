"use strict";
/**
 * Authentication Middleware
 * File: server/middleware/auth.ts
 *
 * Provides authentication checks for protected routes.
 * Supports both session-based and token-based authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachUserInfo = exports.isOwner = exports.requireOnboarding = exports.requireEmailVerified = exports.optionalAuth = exports.isAuthenticated = void 0;
/**
 * Basic authentication check
 * Verifies user is logged in via session
 */
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    console.warn(`[AUTH] Unauthorized access attempt: ${req.method} ${req.path} from ${req.ip}`);
    res.status(401).json({
        error: 'Unauthorized',
        message: 'Please login to access this resource'
    });
};
exports.isAuthenticated = isAuthenticated;
/**
 * Optional authentication check
 * Allows both authenticated and unauthenticated users
 * Useful for endpoints that behave differently based on auth status
 */
const optionalAuth = (_req, _res, next) => {
    // Just continue, authentication is optional
    next();
};
exports.optionalAuth = optionalAuth;
/**
 * Require email verification
 * User must be authenticated AND have verified email
 */
const requireEmailVerified = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please login to access this resource'
        });
    }
    const user = req.user;
    if (!user.emailVerified) {
        return res.status(403).json({
            error: 'Email not verified',
            message: 'Please verify your email to access this resource',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }
    next();
};
exports.requireEmailVerified = requireEmailVerified;
/**
 * Require onboarding completion
 * User must be authenticated AND have completed onboarding
 */
const requireOnboarding = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please login to access this resource'
        });
    }
    const user = req.user;
    if (!user.onboardingDone) {
        return res.status(403).json({
            error: 'Onboarding not completed',
            message: 'Please complete onboarding to access this resource',
            code: 'ONBOARDING_REQUIRED'
        });
    }
    next();
};
exports.requireOnboarding = requireOnboarding;
/**
 * Check if user owns the resource
 * Compares req.user.id with req.params.userId or req.body.userId
 */
const isOwner = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUserId = req.user.id;
    const resourceUserId = req.params.userId || req.body.userId;
    if (currentUserId !== resourceUserId) {
        console.warn(`[AUTH] User ${currentUserId} attempted to access resource owned by ${resourceUserId}`);
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to access this resource'
        });
    }
    next();
};
exports.isOwner = isOwner;
/**
 * Attach user info to request
 * Useful for logging and analytics
 */
const attachUserInfo = (req, _res, next) => {
    if (req.isAuthenticated()) {
        const user = req.user;
        req.userId = user.id;
        req.userEmail = user.email;
        req.userName = user.name;
    }
    next();
};
exports.attachUserInfo = attachUserInfo;
exports.default = {
    isAuthenticated: exports.isAuthenticated,
    optionalAuth: exports.optionalAuth,
    requireEmailVerified: exports.requireEmailVerified,
    requireOnboarding: exports.requireOnboarding,
    isOwner: exports.isOwner,
    attachUserInfo: exports.attachUserInfo,
};
