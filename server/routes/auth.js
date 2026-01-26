"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const passport_2 = require("../config/passport");
const db_1 = require("../lib/db");
const email_1 = require("../lib/email");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.get('/google', (req, res, next) => {
    if (!passport_2.isGoogleAuthConfigured) {
        return res.status(503).json({
            error: 'Google OAuth is not configured. Please contact the administrator.',
        });
    }
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
    })(req, res, next);
});
router.get('/google/callback', (req, res, next) => {
    if (!passport_2.isGoogleAuthConfigured) {
        return res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
    }
    passport_1.default.authenticate('google', { failureRedirect: '/auth' })(req, res, () => {
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
        const existingUser = await db_1.db.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Generate OTP
        const otp = crypto_1.default.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // Create user with all required fields
        const newUser = await db_1.db.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
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
                examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
                examAttempt: null,
                studentClass: null,
                batch: null,
                syllabus: null,
                schoolId: null,
                collegeId: null,
                coachingId: null,
                totalPoints: 0,
                totalStudyMinutes: 0,
                streak: 0,
                lastActive: new Date(),
                showProfile: true,
            },
        });
        console.log('✅ User created:', newUser.email, 'ID:', newUser.id);
        // Send verification email
        try {
            await (0, email_1.sendOTPEmail)(email, otp, name);
            console.log(`✅ OTP email sent to ${email}`);
        }
        catch (emailError) {
            console.error('⚠️  Failed to send OTP email:', emailError.message);
            console.log(`📧 OTP for ${email}: ${otp} (Email service error)`);
        }
        res.json({
            message: 'Signup successful. Please check your email for verification code.',
            // Always include OTP in development mode
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
    }
    catch (error) {
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
        const user = await db_1.db.user.findUnique({ where: { email } });
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
        const updatedUser = await db_1.db.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                verificationOtp: undefined,
                otpExpiry: undefined,
            },
        });
        // Log the user in
        req.login(updatedUser, (err) => {
            if (err) {
                console.error('❌ Login error after verification:', err);
                return res.status(500).json({ error: 'Failed to log in after verification' });
            }
            // Explicitly save session
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('❌ Session save error:', saveErr);
                    return res.status(500).json({ error: 'Failed to save session' });
                }
                console.log('✅ User logged in after verification:', updatedUser.email);
                console.log('📝 Session ID:', req.sessionID);
                console.log('🍪 Session expires:', new Date(Date.now() + (req.session.cookie.maxAge || 0)));
                res.json({ message: 'Email verified successfully', user: updatedUser });
            });
        });
    }
    catch (error) {
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
        const user = await db_1.db.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email already verified' });
        }
        // Generate new OTP
        const otp = crypto_1.default.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await db_1.db.user.update({
            where: { id: user.id },
            data: {
                verificationOtp: otp,
                otpExpiry,
            },
        });
        // Send verification email
        try {
            await (0, email_1.sendOTPEmail)(email, otp);
            console.log(`✅ OTP email sent to ${email}`);
        }
        catch (emailError) {
            console.error('⚠️  Failed to send OTP email:', emailError.message);
            console.log(`📧 OTP for ${email}: ${otp} (Email service error)`);
        }
        res.json({
            message: 'OTP sent successfully',
            // Always include OTP in development mode
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
    }
    catch (error) {
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
        const user = await db_1.db.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
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
                console.error('❌ Login error:', err);
                return res.status(500).json({ error: 'Failed to log in' });
            }
            // Explicitly save session to ensure it persists
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('❌ Session save error:', saveErr);
                    return res.status(500).json({ error: 'Failed to save session' });
                }
                console.log('✅ User logged in:', user.email);
                console.log('📝 Session ID:', req.sessionID);
                console.log('🍪 Session cookie maxAge:', req.session.cookie.maxAge, 'ms');
                console.log('🍪 Session expires:', new Date(Date.now() + (req.session.cookie.maxAge || 0)));
                res.json({ message: 'Login successful', user });
            });
        });
    }
    catch (error) {
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
        const user = await db_1.db.user.findUnique({ where: { email } });
        // Don't reveal if user exists or not for security
        if (!user) {
            return res.json({ message: 'If an account exists, a password reset code has been sent' });
        }
        // Generate OTP
        const otp = crypto_1.default.randomInt(100000, 999999).toString();
        const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await db_1.db.user.update({
            where: { id: user.id },
            data: {
                resetToken: otp,
                resetTokenExpiry,
            },
        });
        // Send password reset email
        try {
            await (0, email_1.sendPasswordResetEmail)(email, otp, user.name);
            console.log(`✅ Password reset OTP sent to ${email}`);
        }
        catch (emailError) {
            console.error('⚠️  Failed to send password reset email:', emailError);
            console.log(`🔑 Reset OTP for ${email}: ${otp} (Email service not configured)`);
        }
        res.json({
            message: 'If an account exists, a password reset code has been sent',
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});
// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({ error: 'Email, OTP, and password are required' });
        }
        const user = await db_1.db.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.resetToken || user.resetToken !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }
        if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
            return res.status(400).json({ error: 'OTP expired' });
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await db_1.db.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: undefined,
                resetTokenExpiry: undefined,
            },
        });
        res.json({ message: 'Password reset successful' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
router.get('/me', (req, res) => {
    console.log('🔍 Checking auth - Session ID:', req.sessionID);
    console.log('🔍 Is authenticated:', req.isAuthenticated());
    console.log('🔍 User:', req.user ? req.user.email : 'none');
    if (req.isAuthenticated()) {
        res.json(req.user);
    }
    else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
router.post('/logout', (req, res) => {
    const userEmail = req.user ? req.user.email : 'unknown';
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
exports.default = router;
