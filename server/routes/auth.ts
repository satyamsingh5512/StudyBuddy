import { Router } from 'express';
import passport from 'passport';
import { isGoogleAuthConfigured } from '../config/passport';
import { authRateLimiter } from '../middleware/rateLimiting';

const router = Router();

// Apply auth rate limiter to all auth routes
router.use(authRateLimiter);

router.get('/google', (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res.status(503).json({
      error: 'Google OAuth is not configured. Please contact the administrator.',
    });
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  }
  passport.authenticate('google', { failureRedirect: '/' })(req, res, () => {
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  });
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

export default router;
