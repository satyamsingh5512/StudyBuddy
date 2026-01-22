import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    // This handles /api/friends (list friends)
    if (req.method === 'GET') {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { senderId: user.id, status: 'ACCEPTED' },
            { receiverId: user.id, status: 'ACCEPTED' },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              avatarType: true,
              examGoal: true,
              totalPoints: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              avatarType: true,
              examGoal: true,
              totalPoints: true,
            },
          },
        },
      });

      const friends = friendships.map((f) => {
        const friend = f.senderId === user.id ? f.receiver : f.sender;
        return { ...friend, friendshipId: f.id };
      });

      return res.status(200).json(friends);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Friends error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
