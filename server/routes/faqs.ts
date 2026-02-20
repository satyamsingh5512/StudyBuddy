import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(isAuthenticated);

router.get('/:examType', async (req, res) => {
  try {
    const { examType } = req.params;
    const faqs = await (await collections.faqs).find(
      { examType, published: true },
      { sort: { order: 1 } }
    ).toArray();
    const formattedFaqs = faqs.map(f => ({ ...f, id: f._id }));
    res.json(formattedFaqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await (await collections.faqs).insertOne(req.body);
    const faq = await (await collections.faqs).findOne({ _id: result.insertedId });
    res.json({ ...faq, id: faq!._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    await (await collections.faqs).updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    const faq = await (await collections.faqs).findOne({ _id: new ObjectId(req.params.id) });
    res.json({ ...faq, id: faq!._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await (await collections.faqs).deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

export default router;
