/**
 * JWT Authentication Utilities
 * File: server/lib/jwt.ts
 *
 * Handles access token + refresh token generation and verification.
 * Uses `jose` library for JWT operations.
 *
 * Access token: 15 min, stored in HttpOnly cookie (web) or Authorization header (mobile)
 * Refresh token: 7 days, hashed before DB storage, rotated on every refresh
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'crypto';

// Secrets — MUST be different for access vs refresh
const ACCESS_SECRET = new TextEncoder().encode(
    process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production'
);
const REFRESH_SECRET = new TextEncoder().encode(
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production'
);

export interface TokenPayload extends JWTPayload {
    userId: string;
    email: string;
}

/**
 * Generate a short-lived access token (15 min)
 */
export async function generateAccessToken(user: { id: string; email: string }): Promise<string> {
    return new SignJWT({ userId: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setSubject(user.id)
        .sign(ACCESS_SECRET);
}

/**
 * Generate a long-lived refresh token (7 days)
 */
export async function generateRefreshToken(user: { id: string; email: string }): Promise<string> {
    return new SignJWT({ userId: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .setSubject(user.id)
        .sign(REFRESH_SECRET);
}

/**
 * Verify and decode an access token
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, ACCESS_SECRET);
        return payload as TokenPayload;
    } catch {
        return null;
    }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, REFRESH_SECRET);
        return payload as TokenPayload;
    } catch {
        return null;
    }
}

/**
 * Hash a refresh token for DB storage (SHA-256)
 * Never store raw refresh tokens in the database
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate both tokens and return them as a pair
 */
export async function generateTokenPair(user: { id: string; email: string }) {
    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(user),
        generateRefreshToken(user),
    ]);
    return { accessToken, refreshToken };
}

/**
 * Set JWT cookies on the response (for web clients)
 */
export function setTokenCookies(
    res: any,
    accessToken: string,
    refreshToken: string
) {
    const isProduction = process.env.NODE_ENV === 'production' ||
        process.env.CLIENT_URL?.startsWith('https');

    // Access token cookie — 15 min
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000, // 15 min
        path: '/',
    });

    // Refresh token cookie — 7 days
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    });
}

/**
 * Clear JWT cookies on logout
 */
export function clearTokenCookies(res: any) {
    const isProduction = process.env.NODE_ENV === 'production' ||
        process.env.CLIENT_URL?.startsWith('https');

    res.cookie('access_token', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 0,
        path: '/',
    });
    res.cookie('refresh_token', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 0,
        path: '/',
    });
}
