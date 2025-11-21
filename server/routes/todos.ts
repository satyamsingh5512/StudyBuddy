import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const router = Router();
const prisma = new PrismaClient();

router.use(isAuthenticated);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const todo = await prisma.todo.create({
      data: {
        ...req.body,
        userId,
      },
    });
    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingTodo = await prisma.todo.findUnique({
      where: { id: req.params.id },
    });

    const todo = await prisma.todo.update({
      where: { id: req.params.id },
      data: req.body,
    });
    
    // Award 1 point when completing a task (regardless of difficulty)
    if (req.body.completed && existingTodo && !existingTodo.completed) {
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: 1 } }, // 1 point per completed task
      });
    }
    
    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
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
