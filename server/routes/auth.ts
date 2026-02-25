import crypto from 'crypto';
import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { isGoogleAuthConfigured } from '../config/passport-config.js';
import { collections } from '../db/collections.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../lib/email.js';
import { isTempEmail, getTempEmailError } from '../lib/emailValidator.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Helper to set session data
const setSessionData = (req: any, user: any) => {
  req.session.userId = user._id.toString();
  req.session.email = user.email;
  req.session.role = user.role || 'user';
};

// ==================== Google OAuth ====================

router.get('/google', (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res.status(503).json({
      error: 'Google OAuth is not configured. Please contact the administrator.',
    });
  }
  // Let passport handle the redirect
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
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
      setSessionData(req, user);

      console.log('✅ Google OAuth login successful:', user?.email);

      if (user && !user.onboardingDone) {
        res.redirect(`${clientUrl}/onboarding`);
      } else {
        res.redirect(`${clientUrl}/dashboard`);
      }
    } catch (error) {
      console.error('❌ Error saving session after Google OAuth:', error);
      res.redirect(`${clientUrl}/auth?error=session_failed`);
    }
  });
});

// ==================== Google OAuth (Mobile) ====================

import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google/mobile', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({ error: 'Invalid ID token' });
    }

    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google profile' });
    }

    let user = await (await collections.users).findOne({ email: email.toLowerCase() });

    if (!user) {
      const newUser = {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        emailVerified: true,
        avatarType: 'image',
        avatar: picture,
        onboardingDone: false,
        examGoal: '',
        examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        totalPoints: 0,
        totalStudyMinutes: 0,
        streak: 0,
        lastActive: new Date(),
        showProfile: true,
        role: 'user' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insertResult = await (await collections.users).insertOne(newUser as any);
      user = await (await collections.users).findOne({ _id: insertResult.insertedId });
      console.log('✅ User created via Google Mobile:', user!.email);
    } else {
      await (await collections.users).updateOne(
        { _id: user._id },
        { $set: { lastActive: new Date(), updatedAt: new Date() } }
      );
    }

    setSessionData(req, user);

    return res.json({
      message: 'Login successful',
      user
    });

  } catch (error) {
    console.error('❌ Google Mobile Auth Error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// ==================== Email/Password Signup ====================

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

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

    const existingUser = await (await collections.users).findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = {
      email: email.toLowerCase(),
      username: `user_${crypto.randomBytes(4).toString('hex')}`,
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
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await (await collections.users).insertOne(newUser as any);
    const createdUser = await (await collections.users).findOne({ _id: insertResult.insertedId });

    console.log('✅ User created:', createdUser!.email, 'ID:', createdUser!._id);
    console.log('📧 OTP for', createdUser!.email, ':', otp);

    sendOTPEmail(createdUser!.email, otp, createdUser!.name).then(() => {
      console.log('✅ Verification email sent successfully to:', createdUser!.email);
    }).catch(err => {
      console.error('❌ Failed to send verification email to:', createdUser!.email);
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

    const user = await (await collections.users).findOne({ email: email.toLowerCase() });

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

    await (await collections.users).updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          lastActive: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          verificationOtp: "",
          otpExpiry: ""
        }
      }
    );

    console.log('✅ User verified:', user.email);

    // Set express session
    setSessionData(req, user);

    res.json({ message: 'Login successful', user });
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

    const user = await (await collections.users).findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await (await collections.users).updateOne(
      { _id: user._id },
      { $set: { verificationOtp: otp, otpExpiry } }
    );

    console.log(`📧 Resending OTP for ${email}:`, otp);
    sendOTPEmail(email, otp, user.name).catch(err => {
      console.error('❌ Failed to resend verification email to:', email);
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

    const user = await (await collections.users).findOne({ email: email.toLowerCase() });

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

      await (await collections.users).updateOne(
        { _id: user._id },
        { $set: { verificationOtp: otp, otpExpiry } }
      );

      console.log(`📧 Sending OTP to unverified user ${user.email}:`, otp);
      sendOTPEmail(user.email, otp, user.name).catch(err => {
        console.error('❌ Failed to send verification email');
      });

      return res.status(403).json({
        error: 'Please verify your email first. A new verification code has been sent.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    await (await collections.users).updateOne(
      { _id: user._id },
      { $set: { lastActive: new Date() } }
    );

    setSessionData(req, user);

    console.log('✅ User logged in:', user.email);

    res.json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

// ==================== Forgot Password ====================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await (await collections.users).findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        message: 'If an account with this email exists, a password reset code has been sent',
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await (await collections.users).updateOne(
      { _id: user._id },
      { $set: { resetToken: otp, resetTokenExpiry } }
    );

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

    const user = await (await collections.users).findOne({ email: email.toLowerCase() });

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

    await (await collections.users).updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetToken: "", resetTokenExpiry: "" }
      }
    );

    // Express-session automatically invalidates sessions on password reset if we destroy the active one
    // However, destroying ALL active sessions for a user requires hitting the session store directly
    // connect-mongo doesn't easily support querying by partial session data, but the current user's is handled:
    if (req.session.userId === user._id.toString()) {
      req.session.destroy(() => { });
    }

    console.log('✅ Password reset successful for:', user.email);
    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ==================== Get Current User ====================

router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await (await collections.users).findOne({ _id: new ObjectId(req.session.userId) });
  if (!user) {
    req.session.destroy(() => { });
    return res.status(401).json({ error: 'User not found' });
  }

  res.json(user);
});

// ==================== Logout ====================

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }

    res.clearCookie('connect.sid');
    console.log('👋 User logged out');
    res.json({ success: true });
  });
});

export default router;
