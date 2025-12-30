/**
 * Optimized Socket.IO Handlers
 * File: server/socket/handlers.optimized.ts
 * 
 * Key optimizations:
 * 1. Token bucket rate limiting per socket
 * 2. Message batching for high-throughput
 * 3. Efficient room management
 * 4. Redis adapter ready for horizontal scaling
 * 5. Connection tracking for metrics
 * 
 * For Redis adapter (horizontal scaling):
 * npm install @socket.io/redis-adapter redis
 */

import { Server, Socket } from 'socket.io';
import prisma from '../lib/prisma';
import { trackSocketConnection } from '../middleware/metrics';

// Rate limiting configuration
const RATE_LIMIT = {
  messages: { max: 10, windowMs: 10000 },  // 10 messages per 10 seconds
  typing: { max: 5, windowMs: 5000 },       // 5 typing events per 5 seconds
};

// Token bucket for rate limiting
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitBuckets = new Map<string, Map<string, TokenBucket>>();

const checkRateLimit = (
  socketId: string, 
  action: keyof typeof RATE_LIMIT
): { allowed: boolean; retryAfter?: number } => {
  const config = RATE_LIMIT[action];
  const now = Date.now();
  
  if (!rateLimitBuckets.has(socketId)) {
    rateLimitBuckets.set(socketId, new Map());
  }
  
  const socketBuckets = rateLimitBuckets.get(socketId)!;
  let bucket = socketBuckets.get(action);
  
  if (!bucket) {
    bucket = { tokens: config.max, lastRefill: now };
    socketBuckets.set(action, bucket);
  }
  
  // Refill tokens
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / config.windowMs) * config.max;
  bucket.tokens = Math.min(config.max, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
  
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    retryAfter: Math.ceil((config.windowMs - timePassed) / 1000) 
  };
};

// Online users tracking with efficient Set operations
const onlineUsers = new Map<string, Set<string>>(); // roomId -> Set<userId>
const userSockets = new Map<string, Set<string>>();  // userId -> Set<socketId>

// Message batching for high throughput
const messageBatch: Array<{ room: string; event: string; data: any }> = [];
let batchTimeout: NodeJS.Timeout | null = null;

const flushMessageBatch = (io: Server) => {
  if (messageBatch.length === 0) return;
  
  const batch = [...messageBatch];
  messageBatch.length = 0;
  
  // Group by room for efficient emission
  const byRoom = new Map<string, Array<{ event: string; data: any }>>();
  for (const msg of batch) {
    if (!byRoom.has(msg.room)) {
      byRoom.set(msg.room, []);
    }
    byRoom.get(msg.room)!.push({ event: msg.event, data: msg.data });
  }
  
  for (const [room, messages] of byRoom) {
    if (messages.length === 1) {
      io.to(room).emit(messages[0].event, messages[0].data);
    } else {
      // Batch multiple messages into single emission
      io.to(room).emit('batch-messages', messages);
    }
  }
};

const queueMessage = (io: Server, room: string, event: string, data: any) => {
  messageBatch.push({ room, event, data });
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      batchTimeout = null;
      flushMessageBatch(io);
    }, 50); // 50ms batching window
  }
};

export const setupSocketHandlers = (io: Server) => {
  // Redis adapter for horizontal scaling (uncomment when using Redis)
  /*
  import { createAdapter } from '@socket.io/redis-adapter';
  import { createClient } from 'redis';
  
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter connected');
  });
  */

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);
    trackSocketConnection(1);

    socket.on('join-chat', async (userId: string) => {
      socket.data.userId = userId;
      const room = 'global-chat';
      socket.join(room);
      
      // Track user online status
      if (!onlineUsers.has(room)) {
        onlineUsers.set(room, new Set());
      }
      onlineUsers.get(room)!.add(userId);
      
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);
      
      // Broadcast online users (debounced)
      io.to(room).emit('online-users', Array.from(onlineUsers.get(room)!));
      io.to(room).emit('user-online', userId);

      // Send recent messages (optimized query with limit)
      try {
        const messages = await prisma.chatMessage.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { 
                id: true, 
                name: true, 
                username: true,
                avatar: true,
                showProfile: true,
                examGoal: true,
                streak: true,
              },
            },
          },
        });
        socket.emit('chat-history', messages.reverse());
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
        socket.emit('chat-history', []);
      }
    });

    socket.on('send-message', async (data: { message: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      // Rate limiting
      const rateCheck = checkRateLimit(socket.id, 'messages');
      if (!rateCheck.allowed) {
        socket.emit('rate-limit', {
          message: 'Please wait before sending another message',
          remainingSeconds: rateCheck.retryAfter,
        });
        return;
      }

      // Validate message
      const message = data.message?.trim();
      if (!message || message.length > 1000) {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      try {
        const savedMessage = await prisma.chatMessage.create({
          data: {
            userId,
            message,
          },
          include: {
            user: {
              select: { 
                id: true, 
                name: true, 
                username: true,
                avatar: true,
                showProfile: true,
                examGoal: true,
                streak: true,
              },
            },
          },
        });

        // Use batched emission for high throughput
        queueMessage(io, 'global-chat', 'new-message', savedMessage);
      } catch (error) {
        console.error('Failed to save message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('delete-message', async (messageId: string) => {
      const userId = socket.data.userId;
      if (!userId || !messageId) return;

      try {
        // Single query: delete only if owner
        const result = await prisma.chatMessage.deleteMany({
          where: { 
            id: messageId,
            userId, // Only owner can delete
          },
        });

        if (result.count > 0) {
          io.to('global-chat').emit('message-deleted', messageId);
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    });

    socket.on('typing', () => {
      const userId = socket.data.userId;
      if (!userId) return;

      // Rate limit typing events
      const rateCheck = checkRateLimit(socket.id, 'typing');
      if (!rateCheck.allowed) return;

      socket.to('global-chat').emit('user-typing', { userId });
    });

    socket.on('stop-typing', () => {
      const userId = socket.data.userId;
      if (!userId) return;

      socket.to('global-chat').emit('user-stop-typing', { userId });
    });

    // Direct message room handling
    socket.on('join-dm', (otherUserId: string) => {
      const userId = socket.data.userId;
      if (!userId) return;

      // Create deterministic room name
      const roomId = [userId, otherUserId].sort().join(':');
      socket.join(`dm:${roomId}`);
    });

    socket.on('leave-dm', (otherUserId: string) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const roomId = [userId, otherUserId].sort().join(':');
      socket.leave(`dm:${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      trackSocketConnection(-1);
      
      const userId = socket.data.userId;
      if (userId) {
        // Remove socket from user's socket set
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          
          // Only mark user offline if no more sockets
          if (sockets.size === 0) {
            userSockets.delete(userId);
            
            for (const [room, users] of onlineUsers) {
              if (users.has(userId)) {
                users.delete(userId);
                io.to(room).emit('user-offline', userId);
                io.to(room).emit('online-users', Array.from(users));
              }
            }
          }
        }
      }
      
      // Cleanup rate limit buckets
      rateLimitBuckets.delete(socket.id);
    });
  });

  // Periodic cleanup of stale data
  setInterval(() => {
    // Clean up empty rooms
    for (const [room, users] of onlineUsers) {
      if (users.size === 0) {
        onlineUsers.delete(room);
      }
    }
  }, 60000); // Every minute
};
