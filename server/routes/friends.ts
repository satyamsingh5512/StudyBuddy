import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { friendRequestRateLimiter } from '../middleware/rateLimiting.js';
import { collections } from '../db/collections.js';
import { cache } from '../lib/cache.js';
import { ObjectId } from 'mongodb';

const router = Router();
router.use(isAuthenticated);

router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const users = await (await collections.users).find(
      {
        $and: [
          { _id: { $ne: userId } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { name: { $regex: query, $options: 'i' } },
            ],
          },
        ],
      },
      {
        limit: 20,
        projection: {
          username: 1,
          name: 1,
          avatar: 1,
          avatarType: 1,
          examGoal: 1,
          totalPoints: 1,
          showProfile: 1,
        }
      }
    ).toArray();

    const formattedUsers = users.map(u => ({ ...u, id: u._id }));
    const userIds = formattedUsers.map(u => u._id);

    const [blocks, friendships] = await Promise.all([
      (await collections.blocks).find({
        $or: [
          { blockerId: userId, blockedId: { $in: userIds } },
          { blockerId: { $in: userIds }, blockedId: userId },
        ],
      }).toArray(),
      (await collections.friendships).find({
        $or: [
          { senderId: userId, receiverId: { $in: userIds } },
          { senderId: { $in: userIds }, receiverId: userId },
        ],
      }).toArray(),
    ]);

    const blockedUserIds = new Set(
      blocks.map(b => b.blockerId.toString() === userId.toString() ? b.blockedId.toString() : b.blockerId.toString())
    );

    const friendshipMap = new Map(
      friendships.map((f: any) => {
        const otherUserId = f.senderId.toString() === userId.toString() ? f.receiverId.toString() : f.senderId.toString();
        return [otherUserId, { status: f.status, isSender: f.senderId.toString() === userId.toString() }];
      })
    );

    const usersWithStatus = formattedUsers
      .filter(user => !blockedUserIds.has(user._id.toString()))
      .map(user => {
        const friendship = friendshipMap.get(user._id.toString());
        return {
          ...user,
          friendshipStatus: friendship?.status || null,
          isSender: friendship?.isSender || false,
        };
      });

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post('/request', friendRequestRateLimiter, async (req, res) => {
  try {
    const senderId = req.user!._id;
    const { receiverId: receiverIdString } = req.body;

    if (!receiverIdString) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }
    const receiverId = new ObjectId(receiverIdString);

    const isBlocked = await (await collections.blocks).findOne({
      $or: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId },
      ],
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot send friend request' });
    }

    const existing = await (await collections.friendships).findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const result = await (await collections.friendships).insertOne({
      senderId,
      receiverId,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const friendship = await (await collections.friendships).findOne({ _id: result.insertedId });

    const receiver = await (await collections.users).findOne(
      { _id: receiverId },
      { projection: { username: 1, name: 1, avatar: 1 } }
    );

    res.json({ ...friendship, id: friendship!._id, receiver });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

router.get('/requests', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;

    const requests = await (await collections.friendships).find(
      { receiverId: userId, status: 'PENDING' },
      { sort: { createdAt: -1 } }
    ).toArray();

    const senderIds = requests.map(r => r.senderId);
    if (senderIds.length > 0) {
      const senders = await (await collections.users).find(
        { _id: { $in: senderIds } },
        {
          projection: {
            username: 1,
            name: 1,
            avatar: 1,
            avatarType: 1,
            examGoal: 1,
            totalPoints: 1,
          }
        }
      ).toArray();

      const senderMap = new Map(senders.map(s => [s._id.toString(), { ...s, id: s._id }]));

      for (const req of requests as any[]) {
        req.id = req._id;
        req.sender = senderMap.get(req.senderId.toString());
      }
    }

    res.json(requests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

router.put('/request/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const friendshipId = new ObjectId(req.params.id);

    const friendship = await (await collections.friendships).findOne({ _id: friendshipId });

    if (!friendship || friendship.receiverId.toString() !== userId.toString()) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await (await collections.friendships).updateOne(
      { _id: friendshipId },
      { $set: { status: 'ACCEPTED', updatedAt: new Date() } }
    );

    const updated = await (await collections.friendships).findOne({ _id: friendshipId });

    cache.delete(`friends:${userId.toString()}`);
    cache.delete(`friends:${friendship.senderId.toString()}`);

    res.json({ ...updated, id: updated!._id });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.put('/request/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const friendshipId = new ObjectId(req.params.id);

    const friendship = await (await collections.friendships).findOne({ _id: friendshipId });

    if (!friendship || friendship.receiverId.toString() !== userId.toString()) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await (await collections.friendships).deleteOne({ _id: friendshipId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

router.get('/list', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const cacheKey = `friends:${userId.toString()}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const friendships = await (await collections.friendships).find({
      $or: [
        { senderId: userId, status: 'ACCEPTED' },
        { receiverId: userId, status: 'ACCEPTED' },
      ],
    }).toArray();

    const userIds = new Set<string>();
    friendships.forEach(f => {
      userIds.add(f.senderId.toString() === userId.toString() ? f.receiverId.toString() : f.senderId.toString());
    });

    const friendsList = await (await collections.users).find(
      { _id: { $in: Array.from(userIds).map(id => new ObjectId(id)) } },
      {
        projection: {
          username: 1,
          name: 1,
          avatar: 1,
          avatarType: 1,
          examGoal: 1,
          totalPoints: 1,
          lastActive: 1,
        }
      }
    ).toArray();

    const friendMap = new Map(friendsList.map(u => [u._id.toString(), { ...u, id: u._id }]));

    const friends = friendships.map(f => {
      const friendId = f.senderId.toString() === userId.toString() ? f.receiverId.toString() : f.senderId.toString();
      const friend = friendMap.get(friendId);
      return {
        friendshipId: f._id,
        ...friend,
      };
    }).filter(f => f.username);

    cache.set(cacheKey, friends, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

router.delete('/:friendshipId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const friendshipId = new ObjectId(req.params.friendshipId);

    const friendship = await (await collections.friendships).findOne({ _id: friendshipId });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.senderId.toString() !== userId.toString() && friendship.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await (await collections.friendships).deleteOne({ _id: friendshipId });

    cache.delete(`friends:${friendship.senderId.toString()}`);
    cache.delete(`friends:${friendship.receiverId.toString()}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfriending:', error);
    res.status(500).json({ error: 'Failed to unfriend' });
  }
});

router.post('/block', isAuthenticated, async (req, res) => {
  try {
    const blockerId = req.user!._id;
    const { userId: userIdString, reason } = req.body;

    if (!userIdString) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const userId = new ObjectId(userIdString);

    await (await collections.friendships).deleteMany({
      $or: [
        { senderId: blockerId, receiverId: userId },
        { senderId: userId, receiverId: blockerId },
      ],
    });

    const result = await (await collections.blocks).insertOne({
      blockerId,
      blockedId: userId,
      reason,
      createdAt: new Date(),
    });

    const block = await (await collections.blocks).findOne({ _id: result.insertedId });

    res.json(block);
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

router.get('/blocked', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;

    const blocks = await (await collections.blocks).find(
      { blockerId: userId },
      { sort: { createdAt: -1 } }
    ).toArray();

    const blockedIds = blocks.map(b => b.blockedId);
    if (blockedIds.length > 0) {
      const blockedUsers = await (await collections.users).find(
        { _id: { $in: blockedIds } },
        {
          projection: {
            username: 1,
            name: 1,
            avatar: 1,
            avatarType: 1,
            examGoal: 1,
            totalPoints: 1,
          }
        }
      ).toArray();

      const userMap = new Map(blockedUsers.map(u => [u._id.toString(), { ...u, id: u._id }]));

      for (const block of blocks as any[]) {
        block.id = block._id;
        block.blocked = userMap.get(block.blockedId.toString());
      }
    }

    res.json(blocks);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

router.delete('/block/:userId', isAuthenticated, async (req, res) => {
  try {
    const blockerId = req.user!._id;
    const userId = new ObjectId(req.params.userId);

    await (await collections.blocks).deleteMany({
      blockerId,
      blockedId: userId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

export default router;
