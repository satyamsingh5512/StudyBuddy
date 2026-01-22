import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';
import cache from '../_lib/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }

  try {
    if (req.method === 'PATCH') {
      const existingTodo = await prisma.todo.findUnique({
        where: { id },
        select: { completed: true, userId: true },
      });

      if (!existingTodo || existingTodo.userId !== user.id) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      const updatedTodo = await prisma.todo.update({
        where: { id },
        data: req.body,
      });

      // Award point if completing task
      if (req.body.completed && !existingTodo.completed) {
        await prisma.user.update({
          where: { id: user.id },
          data: { totalPoints: { increment: 1 } },
        });
      }

      cache.del(`todos:${user.id}`);
      return res.status(200).json(updatedTodo);
    }

    if (req.method === 'DELETE') {
      const todo = await prisma.todo.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!todo || todo.userId !== user.id) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      await prisma.todo.delete({ where: { id } });
      cache.del(`todos:${user.id}`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Todo error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
