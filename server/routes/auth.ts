import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { isGoogleAuthConfigured } from '../config/passport';
import { db } from '../lib/db';
import { sendOTPEmail, sendPasswordResetEmail } from '../lib/email';
import crypto from 'crypto';

const router = Router();

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
  passport.authenticate('google', { failureRedirect: '/auth' })(req, res, () => {
    // Redirect to dashboard after successful Google login
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/dashboard`);
  });
});

// Email/Password Signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: false,
        verificationOtp: otp,
        otpExpiry,
      },
    });

    // Send verification email
    try {
      await sendOTPEmail(email, otp, name);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️  Failed to send OTP email:', emailError.message);
      console.log(`📧 OTP for ${email}: ${otp} (Email service error)`);
    }

    res.json({ 
      message: 'Signup successful. Please check your email for verification code.',
      // Always include OTP in development mode
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const user = await db.user.findUnique({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (!user.verificationOtp || !user.otpExpiry) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (user.verificationOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Mark email as verified
    const updatedUser = await db.user.update({
      where: { id: user.id! },
      data: {
        emailVerified: true,
        verificationOtp: undefined,
        otpExpiry: undefined,
      },
    });

    // Log the user in
    req.login(updatedUser, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to log in after verification' });
      }
      res.json({ message: 'Email verified successfully', user: updatedUser });
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await db.user.findUnique({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: user.id! },
      data: {
        verificationOtp: otp,
        otpExpiry,
      },
    });

    // Send verification email
    try {
      await sendOTPEmail(email, otp);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️  Failed to send OTP email:', emailError.message);
      console.log(`📧 OTP for ${email}: ${otp} (Email service error)`);
    }

    res.json({ 
      message: 'OTP sent successfully',
      // Always include OTP in development mode
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Email/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.user.findUnique({ email });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email not verified. Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Log the user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to log in' });
      }
      res.json({ message: 'Login successful', user });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await db.user.findUnique({ email });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({ message: 'If an account exists, a password reset link has been sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.user.update({
      where: { id: user.id! },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken, user.name);
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️  Failed to send password reset email:', emailError);
      console.log(`🔑 Reset token for ${email}: ${resetToken} (Email service not configured)`);
    }

    res.json({ message: 'If an account exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const user = await db.user.findFirst({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.update({
      where: { id: user.id! },
      data: {
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined,
      },
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
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
