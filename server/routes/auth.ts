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

router.get('/google/callback', (req, res) => {
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

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user with all required fields
    const newUser = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        username: null,
        googleId: null,
        emailVerified: false,
        verificationOtp: otp,
        otpExpiry,
        resetToken: null,
        resetTokenExpiry: null,
        avatar: null,
        avatarType: 'initials',
        onboardingDone: false,
        examGoal: '',
        examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        examAttempt: null,
        studentClass: null,
        batch: null,
        syllabus: null,
        totalPoints: 0,
        totalStudyMinutes: 0,
        streak: 0,
        lastActive: new Date(),
        showProfile: true,
      },
    });
    
    console.log('✅ User created:', newUser.email, 'ID:', newUser.id);
    console.log('📧 OTP for', newUser.email, ':', otp);
    console.log('⚠️  Email service not working - Use OTP above for testing');

    // Try to send email but don't block on it
    sendOTPEmail(email, otp, name).catch(err => {
      console.error('⚠️  Email send failed:', err.message);
    });

    res.json({
      message: 'Account created successfully. Please check your email for verification code.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Verify OTP
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

    // Mark email as verified and clear OTP
    const updatedUser = await db.user.update({
      where: { id: user.id! },
      data: {
        emailVerified: true,
        verificationOtp: undefined,
        otpExpiry: undefined,
        lastActive: new Date(),
      },
    });

    // Log the user in
    req.login(updatedUser, (err) => {
      if (err) {
        console.error('❌ Login error after verification:', err);
        return res.status(500).json({ error: 'Email verified but failed to log in. Please try signing in.' });
      }
      
      // Explicitly save session
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('❌ Session save error:', saveErr);
          return res.status(500).json({ error: 'Email verified but failed to save session. Please try signing in.' });
        }
        
        console.log('✅ User verified and logged in:', updatedUser.email);
        
        res.json({ 
          message: 'Email verified successfully. Welcome to StudyBuddy!', 
          user: updatedUser 
        });
      });
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Failed to verify code. Please try again.' });
  }
});

// Resend OTP
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

    // Send verification email with timeout
    console.log(`📧 OTP for ${email}:`, otp);
    sendOTPEmail(email, otp, user.name).catch(err => {
      console.error('⚠️  Email send failed:', err.message);
    });

    res.json({
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend verification code. Please try again.' });
  }
});

// Email/Password Login
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
      // Generate new OTP for unverified users
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      
      await db.user.update({
        where: { id: user.id! },
        data: { verificationOtp: otp, otpExpiry },
      });

      // Try to send OTP
      console.log(`📧 OTP for ${user.email}:`, otp);
      sendOTPEmail(user.email, otp, user.name).catch(err => {
        console.error('⚠️  Email send failed:', err.message);
      });

      return res.status(403).json({
        error: 'Please verify your email first. A new verification code has been sent.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Update last active
    await db.user.update({
      where: { id: user.id! },
      data: { lastActive: new Date() },
    });

    // Log the user in
    req.login(user, (err) => {
      if (err) {
        console.error('❌ Login error:', err);
        return res.status(500).json({ error: 'Failed to log in. Please try again.' });
      }
      
      // Explicitly save session to ensure it persists
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('❌ Session save error:', saveErr);
          return res.status(500).json({ error: 'Failed to save session. Please try again.' });
        }
        
        console.log('✅ User logged in:', user.email);
        
        res.json({ message: 'Login successful', user });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({ 
        message: 'If an account with this email exists, a password reset code has been sent' 
      });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: user.id! },
      data: {
        resetToken: otp,
        resetTokenExpiry,
      },
    });

    // Send password reset email with timeout
    console.log(`🔑 Reset OTP for ${email}:`, otp);
    sendPasswordResetEmail(email, otp, user.name).catch(err => {
      console.error('⚠️  Email send failed:', err.message);
    });

    res.json({
      message: 'If an account with this email exists, a password reset code has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    // Password validation
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    await db.user.update({
      where: { id: user.id! },
      data: {
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined,
      },
    });

    console.log('✅ Password reset successful for:', user.email);

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
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
  const userEmail = req.user ? (req.user as any).email : 'unknown';
  req.logout(() => {
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Session destruction error:', err);
      }
      console.log('👋 User logged out:', userEmail);
      res.json({ success: true });
    });
  });
});

export default router;
