import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';
import { cache } from '../lib/cache.js';
import { ObjectId } from 'mongodb';

const router = Router();

const getStartOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const isOverdue = (scheduledDate: Date): boolean => {
  const today = getStartOfDay();
  const scheduled = getStartOfDay(new Date(scheduledDate));
  return scheduled < today;
};

const POINTS = {
  ON_TIME_COMPLETION: 2,
  LATE_COMPLETION: 1,
  RESCHEDULE_PENALTY: 0,
  EARLY_COMPLETION_BONUS: 1,
};

router.use(isAuthenticated);

router.get('/', async (req, res) => {
  try {
    const userId = req.user!._id;
    const cacheKey = `todos:${userId.toString()}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const todos = await (await collections.todos).find(
      { userId },
      {
        sort: { scheduledDate: 1 },
        projection: {
          title: 1,
          subject: 1,
          difficulty: 1,
          questionsTarget: 1,
          completed: 1,
          scheduledDate: 1,
          rescheduledCount: 1,
          originalScheduledDate: 1,
          createdAt: 1,
        }
      }
    ).toArray();

    const todosWithStatus = todos.map((todo: any) => {
      const effectiveScheduledDate = todo.scheduledDate || todo.createdAt;
      const rescheduleCount = typeof todo.rescheduledCount === 'number' ? todo.rescheduledCount : 0;
      return {
        ...todo,
        // Always expose a plain string `id` so the frontend doesn't need to map _id
        id: todo._id.toString(),
        scheduledDate: effectiveScheduledDate,
        rescheduledCount: rescheduleCount,
        isOverdue: !todo.completed && effectiveScheduledDate && isOverdue(effectiveScheduledDate),
      };
    });

    cache.set(cacheKey, todosWithStatus, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(todosWithStatus);
  } catch (error) {
    console.error('Todos fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user!._id;
    const { scheduledDate, ...rest } = req.body;

    const scheduled = scheduledDate ? new Date(scheduledDate) : getStartOfDay();

    const todoData = {
      ...rest,
      userId,
      completed: false,
      questionsCompleted: 0,
      scheduledDate: scheduled,
      rescheduledCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await (await collections.todos).insertOne(todoData);
    const todo = await (await collections.todos).findOne({ _id: result.insertedId });

    cache.delete(`todos:${userId.toString()}`);

    res.json({
      ...todo,
      id: todo!._id.toString(),
      isOverdue: false,
    });
  } catch (error) {
    console.error('Todo creation error:', error);
    res.status(500).json({ error: 'Failed to create todo', details: (error as any).message });
  }
});

router.post('/reschedule-all-overdue', async (req, res) => {
  try {
    const userId = req.user!._id;
    const { targetDate } = req.body;

    const scheduleTo = targetDate ? getStartOfDay(new Date(targetDate)) : getStartOfDay();
    const today = getStartOfDay();

    if (scheduleTo < today) {
      return res.status(400).json({ error: 'Cannot schedule tasks in the past' });
    }

    const allTodos = await (await collections.todos).find({ userId, completed: false }).toArray();

    const overdueTodos = allTodos.filter((todo: any) => {
      if (!todo.scheduledDate) return false;
      return isOverdue(todo.scheduledDate);
    });

    if (overdueTodos.length === 0) {
      return res.json({ message: 'No overdue tasks to reschedule', count: 0 });
    }

    const overdueIds = overdueTodos.map(todo => todo._id);
    const result = await (await collections.todos).updateMany(
      { _id: { $in: overdueIds } },
      {
        $set: { scheduledDate: scheduleTo, updatedAt: new Date() },
        $inc: { rescheduledCount: 1 },
      }
    );

    const updatedCount = result.modifiedCount;

    cache.delete(`todos:${userId.toString()}`);

    res.json({
      success: true,
      message: `${updatedCount} task${updatedCount > 1 ? 's' : ''} rescheduled`,
      count: updatedCount,
    });
  } catch (error) {
    console.error('Bulk reschedule error:', error);
    res.status(500).json({ error: 'Failed to reschedule tasks' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!._id;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const todoId = new ObjectId(req.params.id);

    const existingTodo = await (await collections.todos).findOne({ _id: todoId, userId });

    if (!existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const updateMap: any = { ...req.body, updatedAt: new Date() };
    delete updateMap._id;
    delete updateMap.userId;

    await (await collections.todos).updateOne(
      { _id: todoId },
      { $set: updateMap }
    );

    const updatedTodo = await (await collections.todos).findOne({ _id: todoId });

    let pointsToIncrement = 0;
    let pointsToAward = 0;

    if (req.body.completed && !existingTodo.completed) {
      pointsToAward = 0.5;

      const today = getStartOfDay();
      const scheduledDate = existingTodo.scheduledDate ? getStartOfDay(new Date(existingTodo.scheduledDate)) : today;
      const originalScheduledDate = existingTodo.originalScheduledDate ? getStartOfDay(new Date(existingTodo.originalScheduledDate)) : null;

      if (scheduledDate.getTime() === today.getTime()) {
        if (!originalScheduledDate || originalScheduledDate.getTime() === today.getTime()) {
          pointsToAward = 1;
        } else {
          pointsToAward = 0.5;
        }
      } else if (scheduledDate < today) {
        pointsToAward = 0.5;
      }

      pointsToIncrement = pointsToAward === 0.5 ? 1 : Math.round(pointsToAward);
      if (pointsToIncrement > 0) {
        await (await collections.users).updateOne(
          { _id: userId },
          {
            $inc: { totalPoints: pointsToIncrement },
            $set: { lastActive: new Date() }
          }
        );
      }
    }

    cache.delete(`todos:${userId.toString()}`);

    const safeRescheduledCount = typeof updatedTodo!.rescheduledCount === 'number' ? updatedTodo!.rescheduledCount : 0;

    res.json({
      ...updatedTodo,
      rescheduledCount: safeRescheduledCount,
      isOverdue: !updatedTodo!.completed && updatedTodo!.scheduledDate && isOverdue(updatedTodo!.scheduledDate),
      pointsAwarded: req.body.completed && !existingTodo.completed ? pointsToAward : 0,
    });
  } catch (error) {
    console.error('Todo update error:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.patch('/:id/reschedule', async (req, res) => {
  try {
    const userId = req.user!._id;
    const { newDate } = req.body;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const todoId = new ObjectId(req.params.id);

    if (!newDate) {
      return res.status(400).json({ error: 'New date is required' });
    }

    const existingTodo = await (await collections.todos).findOne({ _id: todoId, userId });

    if (!existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (existingTodo.completed) {
      return res.status(400).json({ error: 'Cannot reschedule a completed task' });
    }

    const newScheduledDate = getStartOfDay(new Date(newDate));
    const today = getStartOfDay();

    if (newScheduledDate < today) {
      return res.status(400).json({ error: 'Cannot schedule a task in the past' });
    }

    const currentRescheduledCount = typeof existingTodo.rescheduledCount === 'number' ? existingTodo.rescheduledCount : 0;

    const updateData: any = {
      scheduledDate: newScheduledDate,
      rescheduledCount: currentRescheduledCount + 1,
      updatedAt: new Date()
    };

    if (currentRescheduledCount === 0) {
      updateData.originalScheduledDate = existingTodo.scheduledDate;
    }

    await (await collections.todos).updateOne(
      { _id: todoId },
      { $set: updateData }
    );

    const updatedTodo = await (await collections.todos).findOne({ _id: todoId });

    const pointsToCredit = Math.floor(POINTS.ON_TIME_COMPLETION / 2);

    await (await collections.users).updateOne(
      { _id: userId },
      {
        $inc: { totalPoints: pointsToCredit },
        $set: { lastActive: new Date() }
      }
    );

    cache.delete(`todos:${userId.toString()}`);

    const safeRescheduledCount = typeof updatedTodo!.rescheduledCount === 'number' ? updatedTodo!.rescheduledCount : 0;

    res.json({
      ...updatedTodo,
      rescheduledCount: safeRescheduledCount,
      isOverdue: false,
      message: 'Task rescheduled successfully',
      pointsCredited: pointsToCredit,
    });
  } catch (error) {
    console.error('Todo reschedule error:', error);
    res.status(500).json({ error: 'Failed to reschedule todo' });
  }
});

router.post('/:id/reschedule-to-today', async (req, res) => {
  try {
    const userId = req.user!._id;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const todoId = new ObjectId(req.params.id);

    const existingTodo = await (await collections.todos).findOne({ _id: todoId, userId });

    if (!existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (existingTodo.completed) {
      return res.status(400).json({ error: 'Cannot reschedule a completed task' });
    }

    const today = getStartOfDay();

    const currentRescheduledCount = typeof existingTodo.rescheduledCount === 'number' ? existingTodo.rescheduledCount : 0;

    const updateData: any = {
      scheduledDate: today,
      rescheduledCount: currentRescheduledCount + 1,
      updatedAt: new Date()
    };

    if (currentRescheduledCount === 0) {
      updateData.originalScheduledDate = existingTodo.scheduledDate;
    }

    await (await collections.todos).updateOne(
      { _id: todoId },
      { $set: updateData }
    );

    const updatedTodo = await (await collections.todos).findOne({ _id: todoId });

    const pointsToCredit = Math.floor(POINTS.ON_TIME_COMPLETION / 2);

    await (await collections.users).updateOne(
      { _id: userId },
      {
        $inc: { totalPoints: pointsToCredit },
        $set: { lastActive: new Date() }
      }
    );

    cache.delete(`todos:${userId.toString()}`);

    const safeRescheduledCount = typeof updatedTodo!.rescheduledCount === 'number' ? updatedTodo!.rescheduledCount : 0;

    res.json({
      ...updatedTodo,
      rescheduledCount: safeRescheduledCount,
      isOverdue: false,
      message: 'Task rescheduled to today',
      pointsCredited: pointsToCredit,
    });
  } catch (error) {
    console.error('Todo reschedule error:', error);
    res.status(500).json({ error: 'Failed to reschedule todo' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!._id;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const todoId = new ObjectId(req.params.id);

    await (await collections.todos).deleteOne({ _id: todoId, userId });

    cache.delete(`todos:${userId.toString()}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Todo deletion error:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

export default router;
