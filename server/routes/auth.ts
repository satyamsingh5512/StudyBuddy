import crypto from 'crypto';
import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { isGoogleAuthConfigured } from '../config/passport-config.js';
import { db } from '../lib/db.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../lib/email.js';
import { isTempEmail, getTempEmailError } from '../lib/emailValidator.js';
import {
  generateTokenPair,
  setTokenCookies,
  clearTokenCookies,
  verifyRefreshToken,
  hashToken,
  verifyAccessToken,
} from '../lib/jwt.js';

const router = Router();

/**
 * Detect if the request is from a mobile client
 * Mobile clients send X-Client-Type: mobile header
 */
function isMobileClient(req: any): boolean {
  return req.headers['x-client-type'] === 'mobile';
}

/**
 * Issue JWT tokens and respond appropriately for web vs mobile
 */
async function issueTokens(req: any, res: any, user: any) {
  const { accessToken, refreshToken } = await generateTokenPair({
    id: user.id,
    email: user.email,
  });

  // Store hashed refresh token in DB
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    },
  });

  if (isMobileClient(req)) {
    // Mobile: return tokens in JSON body
    return res.json({
      message: 'Login successful',
      user,
      accessToken,
      refreshToken,
    });
  } else {
    // Web: set HttpOnly cookies
    setTokenCookies(res, accessToken, refreshToken);
    return res.json({ message: 'Login successful', user });
  }
}

// ==================== Google OAuth ====================

router.get('/google', (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res.status(503).json({
      error: 'Google OAuth is not configured. Please contact the administrator.',
    });
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false, // No sessions with JWT
  })(req, res, next);
});

router.get('/google/callback', (req, res) => {
  if (!isGoogleAuthConfigured) {
    return res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  }
  passport.authenticate('google', { session: false, failureRedirect: '/auth' })(req, res, async () => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const user = req.user as any;

    try {
      // Generate JWT tokens
      const { accessToken, refreshToken } = await generateTokenPair({
        id: user.id,
        email: user.email,
      });

      // Store hashed refresh token
      await db.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      });

      // Set cookies and redirect
      setTokenCookies(res, accessToken, refreshToken);

      console.log('✅ Google OAuth login successful:', user?.email);

      if (user && !user.onboardingDone) {
        res.redirect(`${clientUrl}/onboarding`);
      } else {
        res.redirect(`${clientUrl}/dashboard`);
      }
    } catch (error) {
      console.error('❌ Error issuing tokens after Google OAuth:', error);
      res.redirect(`${clientUrl}/auth?error=token_failed`);
    }
  });
});

// ==================== Email/Password Signup ====================

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (isTempEmail(email)) {
      return res.status(400).json({ error: getTempEmailError() });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        emailVerified: false,
        verificationOtp: otp,
        otpExpiry,
        avatarType: 'initials',
        onboardingDone: false,
        examGoal: '',
        examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        totalPoints: 0,
        totalStudyMinutes: 0,
        streak: 0,
        lastActive: new Date(),
        showProfile: true,
        refreshTokenHash: null,
      },
    });

    console.log('✅ User created:', newUser.email, 'ID:', newUser.id);
    console.log('📧 OTP for', newUser.email, ':', otp);

    sendOTPEmail(email, otp, name).then(() => {
      console.log('✅ Verification email sent successfully to:', email);
    }).catch(err => {
      console.error('❌ Failed to send verification email to:', email);
      console.error('❌ Email error:', err);
    });

    res.json({
      message: 'Account created successfully. Please check your email for verification code.',
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// ==================== Verify OTP ====================

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.verificationOtp || !user.otpExpiry) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.verificationOtp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark email as verified
    const updatedUser = await db.user.update({
      where: { id: user.id! },
      data: {
        emailVerified: true,
        verificationOtp: undefined,
        otpExpiry: undefined,
        lastActive: new Date(),
      },
    });

    console.log('✅ User verified:', updatedUser.email);

    // Issue JWT tokens immediately after verification
    await issueTokens(req, res, updatedUser);
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Failed to verify code. Please try again.' });
  }
});

// ==================== Resend OTP ====================

router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: user.id! },
      data: { verificationOtp: otp, otpExpiry },
    });

    console.log(`📧 Resending OTP for ${email}:`, otp);
    sendOTPEmail(email, otp, user.name).then(() => {
      console.log('✅ Verification email resent successfully to:', email);
    }).catch(err => {
      console.error('❌ Failed to resend verification email to:', email);
      console.error('❌ Email error:', err);
    });

    res.json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend verification code. Please try again.' });
  }
});

// ==================== Email/Password Login ====================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await db.user.update({
        where: { id: user.id! },
        data: { verificationOtp: otp, otpExpiry },
      });

      console.log(`📧 Sending OTP to unverified user ${user.email}:`, otp);
      sendOTPEmail(user.email, otp, user.name).then(() => {
        console.log('✅ Verification email sent successfully to:', user.email);
      }).catch(err => {
        console.error('❌ Failed to send verification email to:', user.email);
        console.error('❌ Email error:', err);
      });

      return res.status(403).json({
        error: 'Please verify your email first. A new verification code has been sent.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Update last active
    await db.user.update({
      where: { id: user.id! },
      data: { lastActive: new Date() },
    });

    console.log('✅ User logged in:', user.email);

    await issueTokens(req, res, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

// ==================== Token Refresh ====================

router.post('/refresh', async (req, res) => {
  try {
    // Get refresh token from cookie or body
    const refreshTokenRaw =
      req.cookies?.refresh_token ||
      req.body?.refreshToken;

    if (!refreshTokenRaw) {
      return res.status(401).json({
        error: 'No refresh token provided',
        code: 'NO_REFRESH_TOKEN',
      });
    }

    // Verify the refresh token
    const payload = await verifyRefreshToken(refreshTokenRaw);
    if (!payload) {
      clearTokenCookies(res);
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Check if the hashed token exists in DB
    const tokenHash = hashToken(refreshTokenRaw);
    const storedToken = await db.refreshToken.findFirst({
      where: { tokenHash, userId: payload.userId },
    });

    if (!storedToken) {
      // Token reuse detected — revoke ALL tokens for this user (security measure)
      await db.refreshToken.deleteMany({ where: { userId: payload.userId } });
      clearTokenCookies(res);
      console.warn('⚠️  Refresh token reuse detected for user:', payload.userId);
      return res.status(401).json({
        error: 'Session revoked for security. Please login again.',
        code: 'TOKEN_REUSE',
      });
    }

    // Delete the used refresh token (rotation)
    await db.refreshToken.delete({ where: { id: storedToken.id! } });

    // Verify user still exists
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      clearTokenCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new token pair
    await issueTokens(req, res, user);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ==================== Forgot Password ====================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.json({
        message: 'If an account with this email exists, a password reset code has been sent',
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: user.id! },
      data: { resetToken: otp, resetTokenExpiry },
    });

    console.log(`🔑 Reset OTP for ${email}:`, otp);
    sendPasswordResetEmail(email, otp, user.name).catch(err => {
      console.error('⚠️  Email send failed:', err.message);
    });

    res.json({
      message: 'If an account with this email exists, a password reset code has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// ==================== Reset Password ====================

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.resetToken || user.resetToken !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.user.update({
      where: { id: user.id! },
      data: {
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined,
      },
    });

    // Revoke all refresh tokens on password reset
    await db.refreshToken.deleteMany({ where: { userId: user.id! } });

    console.log('✅ Password reset successful for:', user.email);

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ==================== Get Current User ====================

router.get('/me', async (req, res) => {
  // Extract token
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Token expired or invalid',
      code: 'TOKEN_EXPIRED',
    });
  }

  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json(user);
});

// ==================== Logout ====================

router.post('/logout', async (req, res) => {
  try {
    // Try to revoke the refresh token from DB
    const refreshTokenRaw =
      req.cookies?.refresh_token ||
      req.body?.refreshToken;

    if (refreshTokenRaw) {
      const tokenHash = hashToken(refreshTokenRaw);
      await db.refreshToken.deleteMany({ where: { tokenHash } });
    }

    clearTokenCookies(res);
    console.log('👋 User logged out');
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if DB cleanup fails
    clearTokenCookies(res);
    res.json({ success: true });
  }
});

export default router;
