import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { reportRateLimiter } from '../middleware/rateLimiting.js';
import { collections } from '../db/collections.js';

const router = Router();

router.use(isAuthenticated);

router.post('/', reportRateLimiter, async (req, res) => {
  try {
    const reportData = {
      ...req.body,
      userId: req.user!._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await (await collections.dailyReports).insertOne(reportData);
    const report = await (await collections.dailyReports).findOne({ _id: result.insertedId });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.get('/', async (req, res) => {
  try {
    const reports = await (await collections.dailyReports).find(
      { userId: req.user!._id },
      { sort: { date: -1 }, limit: 30 }
    ).toArray();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

export default router;
