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
    const todo = await prisma.todo.create({
      data: {
        ...req.body,
        userId: (req.user as any).id,
      },
    });
    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const todo = await prisma.todo.update({
      where: { id: req.params.id },
      data: req.body,
    });
    
    // Award points if completed
    if (req.body.completed && !todo.completed) {
      const points = { easy: 10, medium: 25, hard: 50 }[todo.difficulty as keyof typeof points] || 10;
      await prisma.user.update({
        where: { id: (req.user as any).id },
        data: { totalPoints: { increment: points } },
      });
    }
    
    res.json(todo);
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
