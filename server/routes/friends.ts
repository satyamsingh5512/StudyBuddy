/**
 * OPTIMIZED Friends Route (Native MongoDB)
 */

import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { friendRequestRateLimiter } from '../middleware/rateLimiting';
import { db } from '../lib/db';
import { cache } from '../lib/cache';
import { ObjectId } from '../lib/mongodb';

const router = Router();

router.use(isAuthenticated);

// GET /search
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Find users matching query (regex)
    const users = await db.user.findMany({
      where: {
        $and: [
          { _id: { $ne: new ObjectId(userId) } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { name: { $regex: query, $options: 'i' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        avatarType: true,
        examGoal: true,
        totalPoints: true,
        showProfile: true,
      },
      take: 20,
    });

    const userIds = users.map(u => u.id);

    // Batch fetch blocks and friendships
    const [blocks, friendships] = await Promise.all([
      db.block.findMany({
        where: {
          $or: [
            { blockerId: userId, blockedId: { $in: userIds } },
            { blockerId: { $in: userIds }, blockedId: userId },
          ],
        },
      }),
      db.friendship.findMany({
        where: {
          $or: [
            { senderId: userId, receiverId: { $in: userIds } },
            { senderId: { $in: userIds }, receiverId: userId },
          ],
        },
      }),
    ]);

    // Create lookup maps
    const blockedUserIds = new Set(
      blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId)
    );

    const friendshipMap = new Map(
      friendships.map((f: any) => {
        const otherUserId = f.senderId === userId ? f.receiverId : f.senderId;
        return [otherUserId, { status: f.status, isSender: f.senderId === userId }];
      })
    );

    const usersWithStatus = users
      .filter(user => !blockedUserIds.has(user.id))
      .map(user => {
        const friendship = friendshipMap.get(user.id);
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

// Send friend request
router.post('/request', friendRequestRateLimiter, async (req, res) => {
  try {
    const senderId = (req.user as any).id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // Check blocks
    const isBlocked = await db.block.findFirst({
      where: {
        $or: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot send friend request' });
    }

    // Check existing friendship
    const existing = await db.friendship.findFirst({
      where: {
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const friendship = await db.friendship.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });

    // Manually populate receiver for response
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
      }
    });

    res.json({ ...friendship, receiver });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Get friend requests
router.get('/requests', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;

    const requests: any[] = await db.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Populate senders
    const senderIds = requests.map(r => r.senderId);
    if (senderIds.length > 0) {
      // Create simplified map of senders
      const senders = await db.user.findMany({
        where: { _id: { $in: senderIds.map(id => new ObjectId(id)) } },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          avatarType: true,
          examGoal: true,
          totalPoints: true,
        }
      });

      const senderMap = new Map(senders.map(s => [s.id, s]));

      // Attach senders to requests
      for (const req of requests) {
        req.sender = senderMap.get(req.senderId);
      }
    }

    res.json(requests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Accept request
router.put('/request/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { id } = req.params;

    const friendship: any = await db.friendship.findUnique({ where: { id } });

    if (!friendship || friendship.receiverId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const updated = await db.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    cache.delete(`friends:${userId}`);
    cache.delete(`friends:${friendship.senderId}`);

    res.json(updated);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject request
router.put('/request/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { id } = req.params;

    const friendship: any = await db.friendship.findUnique({ where: { id } });

    if (!friendship || friendship.receiverId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await db.friendship.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// Get list
router.get('/list', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const cacheKey = `friends:${userId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const friendships: any[] = await db.friendship.findMany({
      where: {
        $or: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
    });

    // Collect IDs
    const userIds = new Set<string>();
    friendships.forEach(f => {
      userIds.add(f.senderId === userId ? f.receiverId : f.senderId);
    });

    const friendsList = await db.user.findMany({
      where: { _id: { $in: Array.from(userIds).map(id => new ObjectId(id)) } },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        avatarType: true,
        examGoal: true,
        totalPoints: true,
        lastActive: true,
      }
    });

    const friendMap = new Map(friendsList.map(u => [u.id, u]));

    const friends = friendships.map(f => {
      const friendId = f.senderId === userId ? f.receiverId : f.senderId;
      const friend = friendMap.get(friendId);
      return {
        friendshipId: f.id,
        ...friend,
      };
    }).filter(f => f.username); // Filter out possibly deleted users

    cache.set(cacheKey, friends, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Unfriend
router.delete('/:friendshipId', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { friendshipId } = req.params;

    const friendship: any = await db.friendship.findUnique({ where: { id: friendshipId } });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.friendship.delete({ where: { id: friendshipId } });

    cache.delete(`friends:${friendship.senderId}`);
    cache.delete(`friends:${friendship.receiverId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfriending:', error);
    res.status(500).json({ error: 'Failed to unfriend' });
  }
});

// Block
router.post('/block', isAuthenticated, async (req, res) => {
  try {
    const blockerId = (req.user as any).id;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await db.friendship.deleteMany({
      where: {
        $or: [
          { senderId: blockerId, receiverId: userId },
          { senderId: userId, receiverId: blockerId },
        ],
      },
    });

    const block = await db.block.create({
      data: {
        blockerId,
        blockedId: userId,
        reason,
      },
    });

    res.json(block);
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

export default router;
