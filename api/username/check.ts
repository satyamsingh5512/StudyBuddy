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
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    const available = !existing || existing.id === user.id;

    return res.status(200).json({ available });
  } catch (error) {
    console.error('Username check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
