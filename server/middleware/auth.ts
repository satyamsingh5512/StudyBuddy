/**
 * Authentication Middleware (JWT-based)
 * File: server/middleware/auth.ts
 *
 * Provides authentication checks for protected routes.
 * Supports both cookie-based (web) and Bearer token (mobile) authentication.
 *
 * Token resolution order:
 * 1. Authorization: Bearer <token> header (mobile/API clients)
 * 2. access_token cookie (web clients)
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '../lib/jwt.js';
import { db } from '../lib/db.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      jwtPayload?: TokenPayload;
    }
  }
}

/**
 * Extract access token from request
 * Checks Authorization header first (mobile), then cookies (web)
 */
function extractToken(req: Request): string | null {
  // 1. Check Authorization header (mobile / API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Check cookies (web clients)
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }

  return null;
}

/**
 * Resolve user from JWT payload by looking up the database
 */
async function resolveUser(payload: TokenPayload) {
  try {
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    return user;
  } catch {
    return null;
  }
}

/**
 * Basic authentication check
 * Verifies user has a valid access token
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    console.warn(`[AUTH] No token: ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please login to access this resource',
    });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Token expired or invalid',
      message: 'Please refresh your session',
      code: 'TOKEN_EXPIRED',
    });
  }

  const user = await resolveUser(payload);
  if (!user) {
    return res.status(401).json({
      error: 'User not found',
      message: 'Please login again',
    });
  }

  req.user = user;
  req.jwtPayload = payload;
  next();
};

/**
 * Optional authentication check
 * Allows both authenticated and unauthenticated users
 * If a valid token exists, attaches user to request
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload) {
      const user = await resolveUser(payload);
      if (user) {
        req.user = user;
        req.jwtPayload = payload;
      }
    }
  }
  next();
};

/**
 * Require email verification
 * User must be authenticated AND have verified email
 */
export const requireEmailVerified = async (req: Request, res: Response, next: NextFunction) => {
  // First run isAuthenticated logic
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please login to access this resource',
    });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Token expired or invalid',
      message: 'Please refresh your session',
      code: 'TOKEN_EXPIRED',
    });
  }

  const user = await resolveUser(payload);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.jwtPayload = payload;

  if (!(user as any).emailVerified) {
    return res.status(403).json({
      error: 'Email not verified',
      message: 'Please verify your email to access this resource',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
};

/**
 * Require onboarding completion
 * User must be authenticated AND have completed onboarding
 */
export const requireOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please login to access this resource',
    });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Token expired or invalid',
      code: 'TOKEN_EXPIRED',
    });
  }

  const user = await resolveUser(payload);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.jwtPayload = payload;

  if (!(user as any).onboardingDone) {
    return res.status(403).json({
      error: 'Onboarding not completed',
      message: 'Please complete onboarding to access this resource',
      code: 'ONBOARDING_REQUIRED',
    });
  }

  next();
};

/**
 * Check if user owns the resource
 */
export const isOwner = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
  }

  const user = await resolveUser(payload);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.jwtPayload = payload;

  const resourceUserId = req.params.userId || req.body.userId;
  if ((user as any).id !== resourceUserId) {
    console.warn(`[AUTH] User ${(user as any).id} attempted to access resource owned by ${resourceUserId}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource',
    });
  }

  next();
};

/**
 * Attach user info to request (for logging/analytics)
 */
export const attachUserInfo = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload) {
      const user = await resolveUser(payload);
      if (user) {
        req.user = user;
        (req as any).userId = (user as any).id;
        (req as any).userEmail = (user as any).email;
        (req as any).userName = (user as any).name;
      }
    }
  }
  next();
};

export default {
  isAuthenticated,
  optionalAuth,
  requireEmailVerified,
  requireOnboarding,
  isOwner,
  attachUserInfo,
};
