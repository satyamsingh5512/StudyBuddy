import { Router } from 'express';

import { isAuthenticated } from '../middleware/auth';

const router = Router();
import { db } from '../lib/db';

router.use(isAuthenticated);

// Get FAQs for a specific exam type
router.get('/:examType', async (req, res) => {
  try {
    const { examType } = req.params;
    const faqs = await db.fAQ.findMany({
      where: {
        examType,
        published: true,
      },
      orderBy: { order: 'asc' },
    });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Create FAQ (admin only - you can add admin check middleware)
router.post('/', async (req, res) => {
  try {
    const faq = await db.fAQ.create({
      data: req.body,
    });
    res.json(faq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

// Update FAQ
router.patch('/:id', async (req, res) => {
  try {
    const faq = await db.fAQ.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(faq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

// Delete FAQ
router.delete('/:id', async (req, res) => {
  try {
    await db.fAQ.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

export default router;
