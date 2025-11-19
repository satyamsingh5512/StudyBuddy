import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// Save study session
router.post('/session', isAuthenticated, async (req: any, res: any) => {
  try {
    const { minutes } = req.body;
    
    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Invalid session duration' });
    }

    // Update user's total study time
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalStudyMinutes: {
          increment: minutes,
        },
        totalPoints: {
          increment: Math.floor(minutes / 5), // 1 point per 5 minutes
        },
      },
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: 'Failed to save study session' });
  }
});

export default router;
