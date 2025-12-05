import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get conversations list
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get all users the current user has messaged with
    const sentMessages = await prisma.directMessage.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await prisma.directMessage.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const userIds = [
      ...new Set([
        ...sentMessages.map((m) => m.receiverId),
        ...receivedMessages.map((m) => m.senderId),
      ]),
    ];

    // Get user details and last message for each conversation
    const conversations = await Promise.all(
      userIds.map(async (otherUserId) => {
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            avatarType: true,
            lastActive: true,
          },
        });

        const lastMessage = await prisma.directMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.directMessage.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            read: false,
          },
        });

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message time
    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || new Date(0);
      const bTime = b.lastMessage?.createdAt || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages with a specific user
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const { userId } = req.params;

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId, status: 'ACCEPTED' },
          { senderId: userId, receiverId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({ error: 'You can only message friends' });
    }

    // Check if blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: userId },
          { blockerId: userId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot message this user' });
    }

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // Limit to last 100 messages
    });

    // Mark messages as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUserId,
        read: false,
      },
      data: { read: true },
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ error: 'Receiver ID and message are required' });
    }

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId, status: 'ACCEPTED' },
          { senderId: receiverId, receiverId: senderId, status: 'ACCEPTED' },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({ error: 'You can only message friends' });
    }

    // Check if blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    });

    if (isBlocked) {
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

// Mark messages as read
router.put('/read/:userId', isAuthenticated, async (req, res) => {
  try {
    const receiverId = req.user!.id;
    const { userId: senderId } = req.params;

    await prisma.directMessage.updateMany({
      where: {
        senderId,
        receiverId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Delete a message
router.delete('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;

    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.senderId !== userId) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await prisma.directMessage.delete({
      where: { id: messageId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
