import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userLastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 30000; // 30 seconds

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-chat', async (userId: string) => {
      socket.data.userId = userId;
      socket.join('global-chat');

      // Send recent messages
      const messages = await prisma.chatMessage.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });
      socket.emit('chat-history', messages.reverse());
    });

    socket.on('send-message', async (data: { message: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      // Rate limiting
      const lastMessageTime = userLastMessage.get(userId) || 0;
      const now = Date.now();
      if (now - lastMessageTime < RATE_LIMIT_MS) {
        socket.emit('rate-limit', {
          message: 'Please wait before sending another message',
          remainingSeconds: Math.ceil((RATE_LIMIT_MS - (now - lastMessageTime)) / 1000),
        });
        return;
      }

      userLastMessage.set(userId, now);

      const message = await prisma.chatMessage.create({
        data: {
          userId,
          message: data.message,
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      io.to('global-chat').emit('new-message', message);
    });

    socket.on('typing', () => {
      socket.to('global-chat').emit('user-typing', {
        userId: socket.data.userId,
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
