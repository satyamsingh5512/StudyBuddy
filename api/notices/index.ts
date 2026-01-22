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
    const cacheKey = 'notices:all';
    const cached = cache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const notices = await prisma.notice.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    cache.set(cacheKey, notices, 300); // 5 min cache
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(notices);
  } catch (error) {
    console.error('Notices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
