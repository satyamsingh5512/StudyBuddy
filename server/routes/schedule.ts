import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get schedules for a specific date range
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        date: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined,
        },
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'asc' },
      ],
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create a new schedule entry
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { date, startTime, endTime, title, subject, notes } = req.body;

    // Immediate optimistic response
    const optimisticSchedule = {
      id: `temp-${Date.now()}`,
      userId,
      date: new Date(date),
      startTime,
      endTime,
      title: title || '',
      subject: subject || '',
      notes: notes || '',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.json(optimisticSchedule);

    // Background save
    setImmediate(async () => {
      try {
        await prisma.schedule.create({
          data: {
            userId,
            date: new Date(date),
            startTime,
            endTime,
            title: title || '',
            subject: subject || '',
            notes: notes || '',
          },
        });
      } catch (error) {
        console.error('Background schedule save failed:', error);
      }
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update a schedule entry
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { date, startTime, endTime, title, subject, notes, completed } = req.body;

    // Immediate response
    res.json({ success: true });

    // Background update
    setImmediate(async () => {
      try {
        await prisma.schedule.updateMany({
          where: { id, userId },
          data: {
            ...(date && { date: new Date(date) }),
            ...(startTime && { startTime }),
            ...(endTime && { endTime }),
            ...(title !== undefined && { title }),
            ...(subject !== undefined && { subject }),
            ...(notes !== undefined && { notes }),
            ...(completed !== undefined && { completed }),
          },
        });
      } catch (error) {
        console.error('Background schedule update failed:', error);
      }
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete a schedule entry
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const schedule = await prisma.schedule.deleteMany({
      where: { id, userId },
    });

    if (schedule.count === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
