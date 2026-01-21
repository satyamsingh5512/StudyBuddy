import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { reportRateLimiter } from '../middleware/rateLimiting';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(isAuthenticated);

// Apply report rate limiter to report creation
router.post('/', reportRateLimiter, async (req, res) => {
  try {
    const report = await prisma.dailyReport.create({
      data: {
        ...req.body,
        userId: (req.user as any).id,
      },
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.get('/', async (req, res) => {
  try {
    const reports = await prisma.dailyReport.findMany({
      where: { userId: (req.user as any).id },
      orderBy: { date: 'desc' },
      take: 30,
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/', async (req, res) => {
  try {
    const report = await prisma.dailyReport.create({
      data: {
        ...req.body,
        userId: (req.user as any).id,
      },
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

export default router;
