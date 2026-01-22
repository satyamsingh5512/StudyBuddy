import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';

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
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // OPTIMIZATION: Parallel queries for users and friendships
    const [users, friendships] = await Promise.all([
      prisma.user.findMany({
        where: {
          AND: [
            { id: { not: user.id } },
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          avatarType: true,
          examGoal: true,
          totalPoints: true,
        },
        take: 20,
      }),
      prisma.friendship.findMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
        select: {
          senderId: true,
          receiverId: true,
          status: true,
        },
      }),
    ]);

    // Build friendship status map for O(1) lookups
    const friendshipMap = new Map<string, { status: string; isSender: boolean }>();
    friendships.forEach((f) => {
      const otherId = f.senderId === user.id ? f.receiverId : f.senderId;
      friendshipMap.set(otherId, {
        status: f.status,
        isSender: f.senderId === user.id,
      });
    });

    const results = users.map((u) => ({
      ...u,
      friendshipStatus: friendshipMap.get(u.id)?.status || null,
      isSender: friendshipMap.get(u.id)?.isSender || false,
    }));

    return res.status(200).json(results);
  } catch (error) {
    console.error('Friends search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
