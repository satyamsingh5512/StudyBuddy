import { Router } from 'express';

import { isAuthenticated } from '../middleware/auth';

const router = Router();
import { prisma } from '../lib/prisma';

router.use(isAuthenticated);

router.get('/', async (req, res) => {
  try {
    const notices = await prisma.notice.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

router.post('/', async (req, res) => {
  try {
    const notice = await prisma.notice.create({
      data: req.body,
    });
    res.json(notice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

export default router;
