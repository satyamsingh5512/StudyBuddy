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

  const { userId } = req.query;

  try {
    // Get messages with specific user and mark as read in parallel
    const [messages] = await Promise.all([
      prisma.directMessage.findMany({
        where: {
          OR: [
            { senderId: user.id, receiverId: userId as string },
            { senderId: userId as string, receiverId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      // Mark messages as read
      prisma.directMessage.updateMany({
        where: {
          senderId: userId as string,
          receiverId: user.id,
          read: false,
        },
        data: { read: true },
      }),
    ]);

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
