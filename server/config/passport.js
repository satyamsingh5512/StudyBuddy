"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGoogleAuthConfigured = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const db_1 = require("../lib/db");
// Check if Google OAuth credentials are configured
const isGoogleAuthConfigured = process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret';
exports.isGoogleAuthConfigured = isGoogleAuthConfigured;
if (isGoogleAuthConfigured) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await db_1.db.user.findUnique({
                where: { googleId: profile.id },
            });
            if (!user) {
                user = await db_1.db.user.create({
                    data: {
                        googleId: profile.id,
                        email: profile.emails?.[0]?.value || '',
                        name: profile.displayName,
                        username: null,
                        password: null,
                        avatar: profile.photos?.[0]?.value,
                        avatarType: 'url',
                        emailVerified: true, // Google accounts are pre-verified
                        verificationOtp: null,
                        otpExpiry: null,
                        resetToken: null,
                        resetTokenExpiry: null,
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
                console.log('✅ Google user created:', user.email, 'ID:', user.id);
            }
            return done(null, user);
        }
        catch (error) {
            return done(error);
        }
    }));
    passport_1.default.serializeUser((user, done) => {
        console.log('🔐 Serializing user:', user.id);
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            console.log('🔓 Deserializing user:', id);
            const user = await db_1.db.user.findUnique({ where: { id } });
            if (!user) {
                console.log('⚠️  User not found during deserialization:', id);
                return done(null, false);
            }
            console.log('✅ User deserialized:', user.email);
            done(null, user);
        }
        catch (error) {
            console.error('❌ Deserialization error:', error);
            done(error);
        }
    });
}
else {
    console.warn('\n⚠️  WARNING: Google OAuth is not configured!\n' +
        '   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.\n' +
        '   See AUTH_SETUP.md for instructions.\n' +
        '   The server will start but authentication will not work.\n');
}
