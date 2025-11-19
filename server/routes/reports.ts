import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(isAuthenticated);

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
