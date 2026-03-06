import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import { createJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

async function exchangeCodeForTokens(code: string, redirectUri: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token exchange failed: ${err}`);
    }
    return res.json() as Promise<{ access_token: string; id_token: string }>;
}

async function getGoogleProfile(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch Google profile');
    return res.json() as Promise<{
        id: string;
        email: string;
        name: string;
        picture: string;
        verified_email: boolean;
    }>;
}

export async function GET(request: NextRequest) {
    const clientUrl =
        process.env.CLIENT_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000';

    const redirectUri =
        process.env.GOOGLE_CALLBACK_URL ||
        `${clientUrl}/api/auth/google/callback`;

    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error || !code) {
            return NextResponse.redirect(`${clientUrl}/auth?error=google_denied`);
        }

        // Exchange code → tokens
        const { access_token } = await exchangeCodeForTokens(code, redirectUri);

        // Fetch Google profile
        const profile = await getGoogleProfile(access_token);

        const client = await clientPromise;
        const db = client.db('studybuddy');
        const users = db.collection('users');

        // Try to find existing user by googleId or email
        let user = await users.findOne({
            $or: [{ googleId: profile.id }, { email: profile.email }],
        });

        if (user) {
            // Link googleId if not yet linked
            if (!user.googleId) {
                await users.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            googleId: profile.id,
                            avatar: user.avatar || profile.picture,
                            emailVerified: true,
                            updatedAt: new Date(),
                        },
                    }
                );
                user = { ...user, googleId: profile.id, emailVerified: true };
            }
        } else {
            // Create new user from Google profile
            const baseUsername = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const username = `${baseUsername}_${uuidv4().substring(0, 8)}`;

            const newUser = {
                email: profile.email,
                googleId: profile.id,
                name: profile.name,
                username,
                avatar: profile.picture,
                role: 'user',
                emailVerified: true,
                onboardingDone: false,
                totalPoints: 0,
                totalStudyMinutes: 0,
                streak: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastActive: new Date(),
                showProfile: true,
            };

            const result = await users.insertOne(newUser);
            user = { ...newUser, _id: result.insertedId };
        }

        // Issue JWT
        const userId = user._id.toString();
        const token = await createJWT(userId, user.email, user.role || 'user');

        const isProd = process.env.NODE_ENV === 'production';
        cookies().set({
            name: 'connect.sid',
            value: token,
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return NextResponse.redirect(`${clientUrl}/dashboard`);
    } catch (err) {
        console.error('Google callback error:', err);
        return NextResponse.redirect(`${clientUrl}/auth?error=google_failed`);
    }
}
