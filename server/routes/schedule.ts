import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const { startDate, endDate } = req.query;

    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.$gte = new Date(startDate as string);
      if (endDate) where.date.$lte = new Date(endDate as string);
    }

    const schedules = await (await collections.schedules).find(where).sort({ date: -1, startTime: 1 }).toArray();
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const { date, startTime, endTime, title, subject, notes } = req.body;

    const scheduleData = {
      userId,
      date: new Date(date),
      startTime,
      endTime,
      title: title || '',
      subject: subject || '',
      notes: notes || '',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await (await collections.schedules).insertOne(scheduleData);
    const schedule = await (await collections.schedules).findOne({ _id: result.insertedId });
    res.json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const { date, startTime, endTime, title, subject, notes, completed } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (date) updateData.date = new Date(date);
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (title !== undefined) updateData.title = title;
    if (subject !== undefined) updateData.subject = subject;
    if (notes !== undefined) updateData.notes = notes;
    if (completed !== undefined) updateData.completed = completed;

    const result = await (await collections.schedules).updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const result = await (await collections.schedules).deleteOne({ _id: new ObjectId(id), userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
