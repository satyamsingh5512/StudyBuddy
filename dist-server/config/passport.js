"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGoogleAuthConfigured = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
        callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await prisma.user.findUnique({
                where: { googleId: profile.id },
            });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        googleId: profile.id,
                        email: profile.emails?.[0]?.value || '',
                        name: profile.displayName,
                        avatar: profile.photos?.[0]?.value,
                        examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
                    },
                });
            }
            return done(null, user);
        }
        catch (error) {
            return done(error);
        }
    }));
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({ where: { id } });
            done(null, user);
        }
        catch (error) {
            done(error);
        }
    });
}
else {
    console.warn('\n⚠️  WARNING: Google OAuth is not configured!\n' +
        '   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.\n' +
        '   See SETUP.md for instructions.\n' +
        '   The server will start but authentication will not work.\n');
}
