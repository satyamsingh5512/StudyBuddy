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
    if (req.method === 'GET') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      return res.status(200).json(fullUser);
    }

    if (req.method === 'PATCH') {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: req.body,
      });
      return res.status(200).json(updatedUser);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('User error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
