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

  try {
    if (req.method === 'GET') {
      const cacheKey = `todos:${user.id}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached);
      }

      const todos = await prisma.todo.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          subject: true,
          difficulty: true,
          questionsTarget: true,
          completed: true,
          scheduledTime: true,
          createdAt: true,
        },
      });

      cache.set(cacheKey, todos, 120);
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(todos);
    }

    if (req.method === 'POST') {
      const { title, subject, difficulty, questionsTarget } = req.body;

      const todo = await prisma.todo.create({
        data: {
          title,
          subject: subject || 'General',
          difficulty: difficulty || 'medium',
          questionsTarget: questionsTarget || 10,
          userId: user.id,
        },
      });

      cache.del(`todos:${user.id}`);
      return res.status(201).json(todo);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Todos error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
