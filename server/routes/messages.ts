import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { messageRateLimiter } from '../middleware/rateLimiting';
import { db } from '../lib/db';
import { getMongoDb } from '../lib/mongodb';

const router = Router();

// Get conversations list
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const mongoDb = await getMongoDb();
    if (!mongoDb) throw new Error('Database not connected');

    // Get all unique user IDs involved in conversations
    // Using aggregation to mimic distinct findMany with OR
    const distinctUsers = await mongoDb.collection('direct_messages').aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }]
        }
      },
      {
        $project: { senderId: 1, receiverId: 1 }
      },
      {
        $group: {
          _id: null,
          senders: { $addToSet: '$senderId' },
          receivers: { $addToSet: '$receiverId' }
        }
      }
    ]).toArray();

    let participantIds = new Set<string>();
    if (distinctUsers.length > 0) {
      distinctUsers[0].senders.forEach((id: string) => participantIds.add(id));
      distinctUsers[0].receivers.forEach((id: string) => participantIds.add(id));
    }

    // Remove self
    participantIds.delete(userId);
    const userIds = Array.from(participantIds);

    if (userIds.length === 0) {
      return res.json([]);
    }

    // Batch fetch data
    // 1. Fetch users
    const users = await db.user.findMany({
      where: { id: { $in: userIds } }, // Generic findMany supports mongo syntax if passed directly to find
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        avatarType: true,
        lastActive: true,
      },
    });

    // 2. Fetch last messages
    // We want the last message for each conversation
    // Aggregation is best for "last per group"
    const lastMessages = await mongoDb.collection('direct_messages').aggregate([
      {
        $match: {
          $or: [
            { senderId: userId, receiverId: { $in: userIds } },
            { senderId: { $in: userIds }, receiverId: userId }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', userId] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      }
    ]).toArray();

    // 3. Fetch unread counts
    const unreadCounts = await mongoDb.collection('direct_messages').aggregate([
      {
        $match: {
          receiverId: userId,
          read: false,
          senderId: { $in: userIds }
        }
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Map to memory maps
    const lastMessageMap = new Map(lastMessages.map(item => [item._id, item.lastMessage]));
    const unreadCountMap = new Map(unreadCounts.map(item => [item._id, item.count]));

    const conversations = users.map(user => {
      const lastMessage = lastMessageMap.get(user.id);
      const unreadCount = unreadCountMap.get(user.id) || 0;

      return {
        user,
        lastMessage,
        unreadCount
      };
    }).sort((a, b) => { // Sort by last message time
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return dateB - dateA;
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
    const currentUserId = (req.user as any).id;
    const { userId } = req.params;

    const messages = await db.directMessage.findMany({
      where: {
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
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

    const newMessage = await db.directMessage.create({
      data: {
        senderId,
        receiverId: userId,
        message: message.trim(),
        read: false,
      },
    });

    // Emit real-time message if io is available
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${userId}`).emit('new-message', newMessage);
    }

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

    await db.directMessage.updateMany({
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
