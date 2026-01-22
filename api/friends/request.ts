import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId },
          { senderId: receiverId, receiverId: user.id },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friendship already exists' });
    }

    const friendship = await prisma.friendship.create({
      data: {
        senderId: user.id,
        receiverId,
        status: 'PENDING',
      },
    });

    return res.status(201).json(friendship);
  } catch (error) {
    console.error('Friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
