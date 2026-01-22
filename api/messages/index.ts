import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, setCorsHeaders } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      // Get conversations list
      const messages = await prisma.directMessage.findMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
          receiver: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      });

      // Group by conversation partner
      const conversationsMap = new Map();
      messages.forEach((msg) => {
        const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
        if (!conversationsMap.has(partnerId)) {
          conversationsMap.set(partnerId, {
            partner: msg.senderId === user.id ? msg.receiver : msg.sender,
            lastMessage: msg,
            unreadCount: msg.receiverId === user.id && !msg.read ? 1 : 0,
          });
        } else if (msg.receiverId === user.id && !msg.read) {
          conversationsMap.get(partnerId).unreadCount++;
        }
      });

      return res.status(200).json(Array.from(conversationsMap.values()));
    }

    if (req.method === 'POST') {
      const { receiverId, message } = req.body;

      if (!receiverId || !message) {
        return res.status(400).json({ error: 'Receiver and message are required' });
      }

      const newMessage = await prisma.directMessage.create({
        data: {
          senderId: user.id,
          receiverId,
          message,
        },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      });

      return res.status(201).json(newMessage);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
