/**
 * Optimized Messages Routes
 * File: server/routes/messages.optimized.ts
 * 
 * Key optimizations:
 * 1. Single PrismaClient instance
 * 2. Aggregated queries for conversations
 * 3. Cursor-based pagination for messages
 * 4. Batch operations for read status
 * 
 * Replace server/routes/messages.ts with this file
 */

import { Router } from 'express';
import prisma from '../lib/prisma';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

/**
 * OPTIMIZED: Get conversations list
 * Before: 3N queries (N conversations × 3 queries each)
 * After: 2 queries total using raw SQL aggregation
 */
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Single optimized query using Prisma's groupBy and aggregations
    // Get all unique conversation partners with last message info
    const conversations = await prisma.$queryRaw<Array<{
      partnerId: string;
      partnerName: string;
      partnerUsername: string | null;
      partnerAvatar: string | null;
      partnerAvatarType: string;
      partnerLastActive: Date;
      lastMessageId: string;
      lastMessage: string;
      lastMessageTime: Date;
      lastMessageSenderId: string;
      unreadCount: bigint;
    }>>`
      WITH conversation_partners AS (
        SELECT DISTINCT
          CASE 
            WHEN "senderId" = ${userId} THEN "receiverId"
            ELSE "senderId"
          END as partner_id
        FROM "DirectMessage"
        WHERE "senderId" = ${userId} OR "receiverId" = ${userId}
      ),
      last_messages AS (
        SELECT DISTINCT ON (
          CASE 
            WHEN dm."senderId" = ${userId} THEN dm."receiverId"
            ELSE dm."senderId"
          END
        )
          dm.id as last_message_id,
          dm.message as last_message,
          dm."createdAt" as last_message_time,
          dm."senderId" as last_message_sender_id,
          CASE 
            WHEN dm."senderId" = ${userId} THEN dm."receiverId"
            ELSE dm."senderId"
          END as partner_id
        FROM "DirectMessage" dm
        WHERE dm."senderId" = ${userId} OR dm."receiverId" = ${userId}
        ORDER BY partner_id, dm."createdAt" DESC
      ),
      unread_counts AS (
        SELECT 
          "senderId" as partner_id,
          COUNT(*) as unread_count
        FROM "DirectMessage"
        WHERE "receiverId" = ${userId} AND read = false
        GROUP BY "senderId"
      )
      SELECT 
        u.id as "partnerId",
        u.name as "partnerName",
        u.username as "partnerUsername",
        u.avatar as "partnerAvatar",
        u."avatarType" as "partnerAvatarType",
        u."lastActive" as "partnerLastActive",
        lm.last_message_id as "lastMessageId",
        lm.last_message as "lastMessage",
        lm.last_message_time as "lastMessageTime",
        lm.last_message_sender_id as "lastMessageSenderId",
        COALESCE(uc.unread_count, 0) as "unreadCount"
      FROM conversation_partners cp
      JOIN app_users u ON u.id = cp.partner_id
      LEFT JOIN last_messages lm ON lm.partner_id = cp.partner_id
      LEFT JOIN unread_counts uc ON uc.partner_id = cp.partner_id
      ORDER BY lm.last_message_time DESC NULLS LAST
    `;

    // Transform to expected format
    const result = conversations.map(c => ({
      user: {
        id: c.partnerId,
        name: c.partnerName,
        username: c.partnerUsername,
        avatar: c.partnerAvatar,
        avatarType: c.partnerAvatarType,
        lastActive: c.partnerLastActive,
      },
      lastMessage: c.lastMessageId ? {
        id: c.lastMessageId,
        message: c.lastMessage,
        createdAt: c.lastMessageTime,
        senderId: c.lastMessageSenderId,
      } : null,
      unreadCount: Number(c.unreadCount),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * OPTIMIZED: Get messages with cursor pagination
 * Uses cursor-based pagination for consistent performance
 */
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const { userId } = req.params;
    const { cursor, limit = '50' } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 100);

    // Single query to check friendship and block status
    const [friendship, block] = await Promise.all([
      prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: currentUserId, status: 'ACCEPTED' },
          ],
        },
        select: { id: true },
      }),
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: currentUserId, blockedId: userId },
            { blockerId: userId, blockedId: currentUserId },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (!friendship) {
      return res.status(403).json({ error: 'You can only message friends' });
    }

    if (block) {
      return res.status(403).json({ error: 'Cannot message this user' });
    }

    // Fetch messages with cursor pagination
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
    });

    const hasMore = messages.length > take;
    const result = hasMore ? messages.slice(0, -1) : messages;

    // Mark messages as read in background (don't wait)
    setImmediate(async () => {
      try {
        await prisma.directMessage.updateMany({
          where: {
            senderId: userId,
            receiverId: currentUserId,
            read: false,
          },
          data: { read: true },
        });
      } catch (err) {
        console.error('Failed to mark messages as read:', err);
      }
    });

    res.json({
      messages: result.reverse(), // Return in chronological order
      nextCursor: hasMore ? result[0].id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Send a message - Optimized with parallel checks
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ error: 'Receiver ID and message are required' });
    }

    // Parallel checks for friendship and block status
    const [friendship, block] = await Promise.all([
      prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId, receiverId, status: 'ACCEPTED' },
            { senderId: receiverId, receiverId: senderId, status: 'ACCEPTED' },
          ],
        },
        select: { id: true },
      }),
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: receiverId },
            { blockerId: receiverId, blockedId: senderId },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (!friendship) {
      return res.status(403).json({ error: 'You can only message friends' });
    }

    if (block) {
      return res.status(403).json({ error: 'Cannot message this user' });
    }

    const newMessage = await prisma.directMessage.create({
      data: {
        senderId,
        receiverId,
        message,
      },
    });

    res.json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Batch mark messages as read
 */
router.put('/read/:userId', isAuthenticated, async (req, res) => {
  try {
    const receiverId = req.user!.id;
    const { userId: senderId } = req.params;

    const result = await prisma.directMessage.updateMany({
      where: {
        senderId,
        receiverId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

/**
 * Delete a message
 */
router.delete('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;

    const deleted = await prisma.directMessage.deleteMany({
      where: { 
        id: messageId,
        senderId: userId, // Only sender can delete
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
