/**
 * Auth utilities for Vercel Serverless Functions
 * Uses JWT tokens instead of sessions for stateless auth
 */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const COOKIE_NAME = 'sb_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  avatarType?: string;
  onboardingDone?: boolean;
  examGoal: string;
  examDate: Date | null;
  totalPoints: number;
  streak: number;
}

/**
 * Create a JWT token for a user
 */
export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

/**
 * Get the current user from the request
 */
export async function getCurrentUser(req: VercelRequest): Promise<AuthUser | null> {
  const token = req.cookies?.[COOKIE_NAME];
  
  if (!token) return null;
  
  const payload = await verifyToken(token);
  if (!payload) return null;
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatar: true,
      avatarType: true,
      onboardingDone: true,
      examGoal: true,
      examDate: true,
      totalPoints: true,
      streak: true,
    },
  });
  
  return user as AuthUser | null;
}

/**
 * Set auth cookie
 */
export function setAuthCookie(res: VercelResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${isProduction ? 'Secure; SameSite=None' : 'SameSite=Lax'}; Max-Age=${30 * 24 * 60 * 60}`
  );
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res: VercelResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; ${isProduction ? 'Secure; SameSite=None' : 'SameSite=Lax'}; Max-Age=0`
  );
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> {
  const user = await getCurrentUser(req);
  
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  
  return user;
}

/**
 * CORS headers for API routes
 */
export function setCorsHeaders(res: VercelResponse): void {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.CLIENT_URL || '',
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}
