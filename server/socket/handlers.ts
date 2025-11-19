import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userLastMessage = new Map<string, number>();
const onlineUsers = new Set<string>();
const RATE_LIMIT_MS = 30000; // 30 seconds

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-chat', async (userId: string) => {
      socket.data.userId = userId;
      socket.join('global-chat');
      
      // Add user to online list
      onlineUsers.add(userId);
      
      // Broadcast online users
      io.to('global-chat').emit('online-users', Array.from(onlineUsers));
      io.to('global-chat').emit('user-online', userId);

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

    socket.on('mark-read', async (messageIds: string[]) => {
      const userId = socket.data.userId;
      if (!userId || messageIds.length === 0) return;

      // Mark messages as read (you can add this to database if needed)
      socket.to('global-chat').emit('messages-read', { userId, messageIds });
    });

    socket.on('typing', () => {
      socket.to('global-chat').emit('user-typing', {
        userId: socket.data.userId,
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Remove user from online list
      const userId = socket.data.userId;
      if (userId) {
        onlineUsers.delete(userId);
        io.to('global-chat').emit('user-offline', userId);
        io.to('global-chat').emit('online-users', Array.from(onlineUsers));
      }
    });
  });
};
