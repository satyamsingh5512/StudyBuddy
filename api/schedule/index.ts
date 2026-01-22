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
      const { date } = req.query;
      
      const schedules = await prisma.schedule.findMany({
        where: {
          userId: user.id,
          ...(date && { date: new Date(date as string) }),
        },
        orderBy: { startTime: 'asc' },
      });

      return res.status(200).json(schedules);
    }

    if (req.method === 'POST') {
      const schedule = await prisma.schedule.create({
        data: {
          ...req.body,
          userId: user.id,
          date: new Date(req.body.date),
        },
      });

      return res.status(201).json(schedule);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Schedule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
