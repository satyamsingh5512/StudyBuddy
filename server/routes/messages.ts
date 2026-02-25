import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { messageRateLimiter } from '../middleware/rateLimiting.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;

    const distinctUsers = await (await collections.directMessages).aggregate([
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
      distinctUsers[0].senders.forEach((id: ObjectId) => participantIds.add(id.toString()));
      distinctUsers[0].receivers.forEach((id: ObjectId) => participantIds.add(id.toString()));
    }

    participantIds.delete(userId.toString());
    const userIds = Array.from(participantIds).map(id => new ObjectId(id));

    if (userIds.length === 0) {
      return res.json([]);
    }

    const users = await (await collections.users).find(
      { _id: { $in: userIds } },
      {
        projection: {
          name: 1,
          username: 1,
          avatar: 1,
          avatarType: 1,
          lastActive: 1,
        }
      }
    ).toArray();

    const formattedUsers = users.map(u => ({ ...u, id: u._id }));

    const lastMessages = await (await collections.directMessages).aggregate([
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

    const unreadCounts = await (await collections.directMessages).aggregate([
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

    const lastMessageMap = new Map(lastMessages.map(item => [item._id.toString(), item.lastMessage]));
    const unreadCountMap = new Map(unreadCounts.map(item => [item._id.toString(), item.count]));

    const conversations = formattedUsers.map(user => {
      const lastMessage = lastMessageMap.get(user._id.toString());
      const unreadCount = unreadCountMap.get(user._id.toString()) || 0;

      return {
        user,
        lastMessage,
        unreadCount
      };
    }).sort((a, b) => {
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

router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user!._id;
    const targetUserId = new ObjectId(req.params.userId);

    const messages = await (await collections.directMessages).find(
      {
        $or: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
      { sort: { createdAt: 1 }, limit: 50 }
    ).toArray();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:userId', messageRateLimiter, isAuthenticated, async (req, res) => {
  try {
    const senderId = req.user!._id;
    const receiverId = new ObjectId(req.params.userId);
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const messageData = {
      senderId,
      receiverId,
      message: message.trim(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await (await collections.directMessages).insertOne(messageData);
    const newMessage = await (await collections.directMessages).findOne({ _id: result.insertedId });

    const io = req.app.get('io');
    if (io) {
      io.to(`user-${receiverId.toString()}`).emit('new-message', newMessage);
    }

    res.json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.patch('/:userId/read', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user!._id;
    const targetUserId = new ObjectId(req.params.userId);

    await (await collections.directMessages).updateMany(
      {
        senderId: targetUserId,
        receiverId: currentUserId,
        read: false,
      },
      {
        $set: { read: true, updatedAt: new Date() },
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
