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
    const { minutes } = req.body;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Invalid session duration' });
    }

    // Create timer session and update user stats in parallel
    const [session] = await Promise.all([
      prisma.timerSession.create({
        data: {
          userId: user.id,
          duration: minutes,
          sessionType: 'pomodoro',
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          totalPoints: { increment: minutes },
          totalStudyMinutes: { increment: minutes },
          lastActive: new Date(),
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      session,
      message: `+${minutes} points earned`,
    });
  } catch (error) {
    console.error('Timer session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
