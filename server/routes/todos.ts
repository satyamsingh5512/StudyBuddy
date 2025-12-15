import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(isAuthenticated);

router.get('/', async (req, res) => {
  try {
    const todos = await prisma.todo.findMany({
      where: { userId: (req.user as any).id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

router.post('/', async (req, res) => {
  try {
    // Immediately respond with optimistic data
    const optimisticTodo = {
      id: `temp-${Date.now()}`,
      ...req.body,
      userId: (req.user as any).id,
      createdAt: new Date(),
    };
    
    // Send immediate response
    res.json(optimisticTodo);
    
    // Save to database in background
    setImmediate(async () => {
      try {
        await prisma.todo.create({
          data: {
            ...req.body,
            userId: (req.user as any).id,
          },
        });
      } catch (error) {
        console.error('Background todo save failed:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    // Immediate response for better UX
    res.json({ success: true, ...req.body });
    
    // Background processing
    setImmediate(async () => {
      try {
        const existingTodo = await prisma.todo.findUnique({
          where: { id: req.params.id },
        });

        await prisma.todo.update({
          where: { id: req.params.id },
          data: req.body,
        });
        
        // Award 1 point when completing a task (regardless of difficulty)
        if (req.body.completed && existingTodo && !existingTodo.completed) {
          await prisma.user.update({
            where: { id: (req.user as any).id },
            data: { totalPoints: { increment: 1 } },
          });
        }
      } catch (error) {
        console.error('Background todo update failed:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.todo.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

export default router;
