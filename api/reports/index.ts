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
      const reports = await prisma.dailyReport.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 30,
      });
      return res.status(200).json(reports);
    }

    if (req.method === 'POST') {
      const report = await prisma.dailyReport.create({
        data: {
          ...req.body,
          userId: user.id,
        },
      });
      return res.status(201).json(report);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
