import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../lib/db';

// Check if Google OAuth credentials are configured
const isGoogleAuthConfigured =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret';

if (isGoogleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await db.user.findUnique({
            googleId: profile.id,
          });

          if (!user) {
            user = await db.user.create({
              data: {
                googleId: profile.id,
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                emailVerified: true, // Google accounts are pre-verified
                examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.user.findUnique({ id });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
} else {
  console.warn(
    '\n⚠️  WARNING: Google OAuth is not configured!\n' +
      '   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.\n' +
      '   See AUTH_SETUP.md for instructions.\n' +
      '   The server will start but authentication will not work.\n'
  );
}

export { isGoogleAuthConfigured };
