import { Request, Response, NextFunction } from 'express';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';
import { User } from '../types/index.js';

// Extend Express Request to include user explicitly for type safety inside routes
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Basic authentication check
 * Verifies user has an active session
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    console.warn(`[AUTH] No session: ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please login to access this resource',
    });
  }

  try {
    const user = await (await collections.users).findOne({ _id: new ObjectId(req.session.userId) });

    if (!user) {
      // Session exists but user was deleted
      req.session.destroy(() => { });
      return res.status(401).json({
        error: 'User not found',
        message: 'Please login again',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] DB error resolving session user:', error);
    res.status(500).json({ error: 'Internal server error validating session' });
  }
};

/**
 * Optional authentication check
 * Allows both authenticated and unauthenticated users
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    try {
      const user = await (await collections.users).findOne({ _id: new ObjectId(req.session.userId) });
      if (user) {
        req.user = user;
      }
    } catch {
      // suppress optional auth failures
    }
  }
  next();
};

/**
 * Require email verification
 * User must be authenticated AND have verified email
 */
export const requireEmailVerified = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please login to access this resource',
    });
  }

  try {
    const user = await (await collections.users).findOne({ _id: new ObjectId(req.session.userId) });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email to access this resource',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error checking verification' });
  }
};

/**
 * Require onboarding completion
 */
export const requireOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  try {
    const user = await (await collections.users).findOne({ _id: new ObjectId(req.session.userId) });
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;

    if (!user.onboardingDone) {
      return res.status(403).json({
        error: 'Onboarding not completed',
        code: 'ONBOARDING_REQUIRED',
      });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error checking onboarding' });
  }
};

/**
 * Check if user owns the resource (based on userId param or body value)
 */
export const isOwner = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resourceUserId = req.params.userId || req.body.userId;
  if (!resourceUserId || req.session.userId !== resourceUserId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource',
    });
  }

  next();
};

export default {
  isAuthenticated,
  optionalAuth,
  requireEmailVerified,
  requireOnboarding,
  isOwner,
};
