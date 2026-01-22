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

  const { id } = req.query;

  try {
    if (req.method === 'PATCH') {
      const schedule = await prisma.schedule.findUnique({
        where: { id: id as string },
      });

      if (!schedule || schedule.userId !== user.id) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const updated = await prisma.schedule.update({
        where: { id: id as string },
        data: req.body,
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const schedule = await prisma.schedule.findUnique({
        where: { id: id as string },
      });

      if (!schedule || schedule.userId !== user.id) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      await prisma.schedule.delete({
        where: { id: id as string },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Schedule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
