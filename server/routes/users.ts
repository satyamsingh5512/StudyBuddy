import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(isAuthenticated);

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { totalPoints: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        avatar: true,
        totalPoints: true,
        streak: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: (req.user as any).id },
      data: req.body,
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/onboarding', async (req, res) => {
  try {
    const { username, avatarType, avatar } = req.body;
    const userId = (req.user as any).id;

    // Check if username is already taken
    if (username) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });

      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        avatarType,
        avatar,
        onboardingDone: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
