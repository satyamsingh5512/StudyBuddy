import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';
import cache from '../_lib/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const cacheKey = 'leaderboard:global';
    const cached = cache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const users = await prisma.user.findMany({
      where: { showProfile: true },
      orderBy: { totalPoints: 'desc' },
      take: 100,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        avatarType: true,
        examGoal: true,
        totalPoints: true,
        streak: true,
      },
    });

    cache.set(cacheKey, users, 60); // 1 min cache
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(users);
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
