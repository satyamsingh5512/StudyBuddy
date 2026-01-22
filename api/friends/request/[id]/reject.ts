import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;

  try {
    const friendship = await prisma.friendship.findUnique({
      where: { id: id as string },
    });

    if (!friendship || friendship.receiverId !== user.id) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.friendship.delete({
      where: { id: id as string },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Reject request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
