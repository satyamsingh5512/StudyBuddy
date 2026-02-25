import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';

const router = Router();

router.use(isAuthenticated);

router.get('/', async (_req, res) => {
  try {
    const notices = await (await collections.notices).find(
      { published: true },
      { sort: { createdAt: -1 }, limit: 50 }
    ).toArray();
    const formattedNotices = notices.map(n => ({ ...n, id: n._id }));
    res.json(formattedNotices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await (await collections.notices).insertOne({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const notice = await (await collections.notices).findOne({ _id: result.insertedId });
    res.json({ ...notice, id: notice!._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

export default router;
