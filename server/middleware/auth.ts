/**
 * Authentication Middleware
 * File: server/middleware/auth.ts
 * 
 * Provides authentication checks for protected routes.
 * Supports both session-based and token-based authentication.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Basic authentication check
 * Verifies user is logged in via session
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  console.warn(`[AUTH] Unauthorized access attempt: ${req.method} ${req.path} from ${req.ip}`);
  res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Please login to access this resource'
  });
};

/**
 * Optional authentication check
 * Allows both authenticated and unauthenticated users
 * Useful for endpoints that behave differently based on auth status
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Just continue, authentication is optional
  next();
};

/**
 * Require email verification
 * User must be authenticated AND have verified email
 */
export const requireEmailVerified = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Please login to access this resource'
    });
  }
  
  const user = req.user as any;
  if (!user.emailVerified) {
    return res.status(403).json({ 
      error: 'Email not verified',
      message: 'Please verify your email to access this resource',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  
  next();
};

/**
 * Require onboarding completion
 * User must be authenticated AND have completed onboarding
 */
export const requireOnboarding = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Please login to access this resource'
    });
  }
  
  const user = req.user as any;
  if (!user.onboardingDone) {
    return res.status(403).json({ 
      error: 'Onboarding not completed',
      message: 'Please complete onboarding to access this resource',
      code: 'ONBOARDING_REQUIRED'
    });
  }
  
  next();
};

/**
 * Check if user owns the resource
 * Compares req.user.id with req.params.userId or req.body.userId
 */
export const isOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const currentUserId = (req.user as any).id;
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

/**
 * Attach user info to request
 * Useful for logging and analytics
 */
export const attachUserInfo = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    const user = req.user as any;
    (req as any).userId = user.id;
    (req as any).userEmail = user.email;
    (req as any).userName = user.name;
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
