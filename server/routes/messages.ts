import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { messageRateLimiter } from '../middleware/rateLimiting';
import { prisma } from '../lib/prisma';

const router = Router();

// Get conversations list - Optimized with batch queries
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;

    // Get all unique user IDs in single query
    const messageParticipants = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
      distinct: ['senderId', 'receiverId'],
    });

    const userIds = Array.from(
      new Set(
        [
          ...messageParticipants.map((m) => m.senderId),
          ...messageParticipants.map((m) => m.receiverId),
        ].filter((id) => id !== userId)
      )
    );

    if (userIds.length === 0) {
      return res.json([]);
    }

    // Batch fetch all required data
    const [users, lastMessages, unreadCounts] = await Promise.all([
      // Fetch all users at once
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          avatarType: true,
          lastActive: true,
        },
      }),

      // Fetch last messages for all conversations
      prisma.directMessage.findMany({
        where: {
          OR: userIds
            .map((otherUserId) => [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ])
            .flat(),
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Fetch unread counts
      prisma.directMessage.groupBy({
        by: ['senderId'],
        where: {
          receiverId: userId,
          read: false,
          senderId: { in: userIds },
        },
        _count: { id: true },
      }),
    ]);

    // Process results in memory (much faster than database queries)
    const conversations = userIds
      .map((otherUserId) => {
        const user = users.find((u) => u.id === otherUserId);
        const lastMessage = lastMessages
          .filter(
            (m) =>
              (m.senderId === userId && m.receiverId === otherUserId) ||
              (m.senderId === otherUserId && m.receiverId === userId)
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const unreadCount = unreadCounts.find((uc) => uc.senderId === otherUserId)?._count.id || 0;

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
      .filter((conv) => conv.user); // Remove conversations with deleted users

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages with a specific user
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = (req.user as any).id;
    const { userId } = req.params;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50, // Limit to last 50 messages for performance
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/:userId', messageRateLimiter, isAuthenticated, async (req, res) => {
  try {
    const senderId = (req.user as any).id;
    const { userId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const newMessage = await prisma.directMessage.create({
      data: {
        senderId,
        receiverId: userId,
        message: message.trim(),
      },
    });

    // Emit real-time message
    req.app.get('io').to(`user-${userId}`).emit('new-message', newMessage);

    res.json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.patch('/:userId/read', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = (req.user as any).id;
    const { userId } = req.params;

    await prisma.directMessage.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUserId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
