/**
 * Enhanced Chat Socket Handlers with Redis Caching
 * File: server/socket/chatHandlers.ts
 * 
 * Features:
 * - Real-time messaging with Socket.IO
 * - Redis caching for performance
 * - Batch database writes
 * - Rate limiting
 * - Typing indicators
 * - Online presence
 * - Message persistence
 */

import { Server, Socket } from 'socket.io';
import { redisClient } from '../lib/redis';
import { db } from '../lib/db';
import { generateId } from '../lib/mongodb';

// Rate limiting
const userLastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 seconds between messages
const MAX_MESSAGE_LENGTH = 1000;

// Batch persistence configuration
const BATCH_INTERVAL_MS = 5000; // Persist every 5 seconds

/**
 * Validate and sanitize message
 */
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }
  
  const trimmed = message.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  }
  
  return { valid: true };
}

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): { allowed: boolean; remainingMs?: number } {
  const lastMessageTime = userLastMessage.get(userId) || 0;
  const now = Date.now();
  const timeSinceLastMessage = now - lastMessageTime;
  
  if (timeSinceLastMessage < RATE_LIMIT_MS) {
    return {
      allowed: false,
      remainingMs: RATE_LIMIT_MS - timeSinceLastMessage,
    };
  }
  
  userLastMessage.set(userId, now);
  return { allowed: true };
}

/**
 * Batch persist messages to MongoDB
 */
async function persistMessageBatch() {
  const messages = redisClient.getMessageQueue();
  
  if (messages.length === 0) {
    return;
  }
  
  try {
    console.log(`💾 Persisting ${messages.length} messages to MongoDB...`);
    
    // Insert messages one by one (MongoDB doesn't have createMany in our abstraction)
    for (const msg of messages) {
      try {
        await db.chatMessage.create({
          data: {
            id: msg.id,
            userId: msg.userId,
            message: msg.message,
            roomId: msg.roomId,
            createdAt: new Date(msg.timestamp),
          },
        });
      } catch (error) {
        // Skip if message already exists
        console.error('Failed to persist message:', msg.id, error);
      }
    }
    
    console.log(`✅ Persisted ${messages.length} messages`);
  } catch (error) {
    console.error('❌ Failed to persist messages:', error);
  }
}

/**
 * Start batch persistence worker
 */
function startBatchPersistence() {
  setInterval(async () => {
    await persistMessageBatch();
  }, BATCH_INTERVAL_MS);
  
  console.log(`🔄 Batch persistence started (interval: ${BATCH_INTERVAL_MS}ms)`);
}

/**
 * Setup enhanced chat handlers
 */
export function setupEnhancedChatHandlers(io: Server) {
  // Start batch persistence worker
  startBatchPersistence();
  
  io.on('connection', (socket: Socket) => {
    console.log('🔌 User connected:', socket.id);
    
    // Error handler for socket
    socket.on('error', (error) => {
      console.error('❌ Socket error:', socket.id, error);
    });
    
    /**
     * Join chat room
     */
    socket.on('join-chat', async (data: { userId: string; roomId?: string }) => {
      try {
        const { userId, roomId = 'global-chat' } = data;
        
        // Authenticate user (in production, verify JWT)
        if (!userId) {
          socket.emit('error', { message: 'User ID required' });
          return;
        }
        
        // Store user data in socket
        socket.data.userId = userId;
        socket.data.roomId = roomId;
        
        // Join room
        socket.join(roomId);
        
        // Add to online users
        await redisClient.addOnlineUser(userId, socket.id);
        
        // Get user info from database
        const user = await db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            avatarType: true,
            examGoal: true,
            streak: true,
          },
        });
        
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }
        
        // Store user info in socket
        socket.data.user = user;
        
        // Broadcast user joined
        socket.to(roomId).emit('user-joined', {
          userId,
          userName: user.name,
          userAvatar: user.avatar,
        });
        
        // Send online users list
        const onlineUsers = await redisClient.getOnlineUsers();
        socket.emit('online-users', onlineUsers);
        io.to(roomId).emit('online-count', onlineUsers.length);
        
        // Send cached messages from Redis (fast)
        const cachedMessages = await redisClient.getCachedMessages(roomId, 50);
        
        if (cachedMessages.length > 0) {
          socket.emit('chat-history', cachedMessages.reverse());
        } else {
          // Fallback to database if cache is empty
          const dbMessages = await db.chatMessage.findMany({
            where: { roomId },
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              userId: true,
              message: true,
              createdAt: true,
            },
          });
          
          // Get user info for messages
          const userIds = Array.from(new Set(dbMessages.map((m: any) => m.userId))).filter(Boolean);
          
          // Fetch users one by one to avoid $in issues
          const users = [];
          for (const userId of userIds) {
            try {
              const user = await db.user.findUnique({
                where: { id: userId },
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatar: true,
                  avatarType: true,
                },
              });
              if (user) users.push(user);
            } catch (error) {
              console.error('Failed to fetch user:', userId, error);
            }
          }
          
          const userMap = new Map(users.map((u: any) => [u.id, u]));
          
          const messages = dbMessages.map((msg: any) => ({
            id: msg.id!,
            userId: msg.userId,
            message: msg.message,
            roomId,
            timestamp: msg.createdAt.getTime(),
            userName: userMap.get(msg.userId)?.name,
            userAvatar: userMap.get(msg.userId)?.avatar,
          }));
          
          socket.emit('chat-history', messages.reverse());
          
          // Cache messages in Redis for next time
          for (const msg of messages) {
            await redisClient.cacheMessage(roomId, msg);
          }
        }
        
        console.log(`✅ User ${userId} joined room ${roomId}`);
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });
    
    /**
     * Send message
     */
    socket.on('send-message', async (data: { message: string }) => {
      try {
        const userId = socket.data.userId;
        const roomId = socket.data.roomId || 'global-chat';
        const user = socket.data.user;
        
        if (!userId || !user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        
        // Validate message
        const validation = validateMessage(data.message);
        if (!validation.valid) {
          socket.emit('error', { message: validation.error });
          return;
        }
        
        // Check rate limit
        const rateLimit = checkRateLimit(userId);
        if (!rateLimit.allowed) {
          socket.emit('rate-limit', {
            message: 'Please wait before sending another message',
            remainingMs: rateLimit.remainingMs,
          });
          return;
        }
        
        // Create message object
        const messageId = generateId();
        const timestamp = Date.now();
        
        const message = {
          id: messageId,
          userId,
          message: data.message.trim(),
          roomId,
          timestamp,
          userName: user.name,
          userAvatar: user.avatar,
          userAvatarType: user.avatarType,
        };
        
        // Cache in Redis (instant)
        await redisClient.cacheMessage(roomId, message);
        
        // Broadcast to room (instant)
        io.to(roomId).emit('new-message', message);
        
        // Stop typing indicator
        await redisClient.setTyping(roomId, userId, false);
        io.to(roomId).emit('user-stopped-typing', { userId });
        
        console.log(`📨 Message sent by ${user.name} in ${roomId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    /**
     * Typing indicator
     */
    socket.on('typing', async (data: { isTyping: boolean }) => {
      try {
        const userId = socket.data.userId;
        const roomId = socket.data.roomId || 'global-chat';
        const user = socket.data.user;
        
        if (!userId || !user) return;
        
        await redisClient.setTyping(roomId, userId, data.isTyping);
        
        if (data.isTyping) {
          socket.to(roomId).emit('user-typing', {
            userId,
            userName: user.name,
          });
        } else {
          socket.to(roomId).emit('user-stopped-typing', { userId });
        }
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });
    
    /**
     * Load more messages (pagination)
     */
    socket.on('load-more-messages', async (data: { before: number; limit?: number }) => {
      try {
        const roomId = socket.data.roomId || 'global-chat';
        const limit = Math.min(data.limit || 50, 100); // Max 100 messages
        
        const messages = await db.chatMessage.findMany({
          where: {
            roomId,
            createdAt: { $lt: new Date(data.before) },
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            message: true,
            createdAt: true,
          },
        });
        
        // Get user info
        const userIds = Array.from(new Set(messages.map((m: any) => m.userId))).filter(Boolean);
        
        // Fetch users one by one to avoid $in issues
        const users = [];
        for (const userId of userIds) {
          try {
            const user = await db.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                avatarType: true,
              },
            });
            if (user) users.push(user);
          } catch (error) {
            console.error('Failed to fetch user:', userId, error);
          }
        }
        
        const userMap = new Map(users.map((u: any) => [u.id, u]));
        
        const formattedMessages = messages.map((msg: any) => ({
          id: msg.id!,
          userId: msg.userId,
          message: msg.message,
          roomId,
          timestamp: msg.createdAt.getTime(),
          userName: userMap.get(msg.userId)?.name,
          userAvatar: userMap.get(msg.userId)?.avatar,
        }));
        
        socket.emit('more-messages', formattedMessages.reverse());
      } catch (error) {
        console.error('Load more messages error:', error);
        socket.emit('error', { message: 'Failed to load messages' });
      }
    });
    
    /**
     * Delete message
     */
    socket.on('delete-message', async (data: { messageId: string }) => {
      try {
        const userId = socket.data.userId;
        const roomId = socket.data.roomId || 'global-chat';
        
        if (!userId) return;
        
        // Verify ownership (or admin)
        const message: any = await db.chatMessage.findUnique({
          where: { id: data.messageId },
        });
        
        if (!message || message.userId !== userId) {
          socket.emit('error', { message: 'Cannot delete this message' });
          return;
        }
        
        // Delete from database
        await db.chatMessage.delete({
          where: { id: data.messageId },
        });
        
        // Broadcast deletion
        io.to(roomId).emit('message-deleted', { messageId: data.messageId });
        
        console.log(`🗑️  Message ${data.messageId} deleted by ${userId}`);
      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });
    
    /**
     * Disconnect
     */
    socket.on('disconnect', async () => {
      try {
        const userId = socket.data.userId;
        const roomId = socket.data.roomId || 'global-chat';
        
        if (userId) {
          // Remove from online users
          await redisClient.removeOnlineUser(userId);
          
          // Remove typing indicator
          await redisClient.setTyping(roomId, userId, false);
          
          // Broadcast user left
          socket.to(roomId).emit('user-left', { userId });
          
          // Update online count
          const onlineUsers = await redisClient.getOnlineUsers();
          io.to(roomId).emit('online-count', onlineUsers.length);
          
          console.log(`👋 User ${userId} disconnected`);
        }
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });
  
  console.log('✅ Enhanced chat handlers initialized');
}

export default setupEnhancedChatHandlers;
