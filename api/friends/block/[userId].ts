import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { userId } = req.query;

  try {
    await prisma.block.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: userId as string,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
