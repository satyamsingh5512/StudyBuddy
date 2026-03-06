import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import { createJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/auth/google/mobile
 *
 * Used by the Capacitor Android app which obtains a Google ID token
 * natively and posts it here for server-side verification and login.
 *
 * Body: { idToken: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
        }

        // Verify the ID token with Google's tokeninfo endpoint
        const verifyRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        if (!verifyRes.ok) {
            return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
        }

        const payload = await verifyRes.json() as {
            sub: string;
            email: string;
            name: string;
            picture: string;
            email_verified: string;
            aud: string;
        };

        // Verify the token is intended for this app
        const clientId = process.env.GOOGLE_CLIENT_ID!;
        if (payload.aud !== clientId) {
            return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db('studybuddy');
        const users = db.collection('users');

        let user = await users.findOne({
            $or: [{ googleId: payload.sub }, { email: payload.email }],
        });

        if (user) {
            if (!user.googleId) {
                await users.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            googleId: payload.sub,
                            avatar: user.avatar || payload.picture,
                            emailVerified: true,
                            updatedAt: new Date(),
                        },
                    }
                );
                user = { ...user, googleId: payload.sub, emailVerified: true };
            }
        } else {
            const baseUsername = payload.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const username = `${baseUsername}_${uuidv4().substring(0, 8)}`;

            const newUser = {
                email: payload.email,
                googleId: payload.sub,
                name: payload.name,
                username,
                avatar: payload.picture,
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
            maxAge: 30 * 24 * 60 * 60,
        });

        const safeUser = { ...user, _id: userId, id: userId };
        return NextResponse.json({ message: 'Google login successful', user: safeUser, token });
    } catch (err) {
        console.error('Google mobile auth error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
