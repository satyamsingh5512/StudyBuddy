import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const prisma = new PrismaClient();
const router = Router();

// Save study session
router.post('/session', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { minutes } = req.body;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    if (!minutes || minutes < 1) {
      res.status(400).json({ error: 'Invalid session duration' });
      return;
    }

    // Update user's total study time
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        totalStudyMinutes: {
          increment: minutes,
        },
        totalPoints: {
          increment: minutes, // 1 point per minute studied continuously
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
