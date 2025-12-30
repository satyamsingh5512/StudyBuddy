/**
 * Optimized Friends Routes
 * File: server/routes/friends.optimized.ts
 * 
 * Key optimizations:
 * 1. Single PrismaClient instance
 * 2. Batch queries instead of N+1
 * 3. Efficient JOINs using Prisma includes
 * 4. Cursor-based pagination
 * 
 * Replace server/routes/friends.ts with this file
 */

import { Router } from 'express';
import prisma from '../lib/prisma';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

/**
 * OPTIMIZED: Search users by username
 * Before: 2N+1 queries (N users × 2 checks + 1 search)
 * After: 3 queries total (search + batch blocks + batch friendships)
 */
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { query, cursor, limit = '20' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const take = Math.min(parseInt(limit as string) || 20, 50);

    // Single query to find users
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
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
      take: take + 1, // Fetch one extra to check if there's more
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      orderBy: { name: 'asc' },
    });

    const hasMore = users.length > take;
    const results = hasMore ? users.slice(0, -1) : users;
    const userIds = results.map(u => u.id);

    // Batch query: Get all blocks involving these users
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: userIds } },
          { blockerId: { in: userIds }, blockedId: userId },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });

    const blockedSet = new Set(
      blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId)
    );

    // Batch query: Get all friendships involving these users
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: { in: userIds } },
          { senderId: { in: userIds }, receiverId: userId },
        ],
      },
      select: { senderId: true, receiverId: true, status: true },
    });

    const friendshipMap = new Map(
      friendships.map(f => [
        f.senderId === userId ? f.receiverId : f.senderId,
        { status: f.status, isSender: f.senderId === userId },
      ])
    );

    // Combine results (no additional queries!)
    const usersWithStatus = results
      .filter(user => !blockedSet.has(user.id))
      .map(user => ({
        ...user,
        friendshipStatus: friendshipMap.get(user.id)?.status || null,
        isSender: friendshipMap.get(user.id)?.isSender || false,
      }));

    res.json({
      users: usersWithStatus,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * OPTIMIZED: Get friends list with last activity
 * Uses single query with includes instead of N+1
 */
router.get('/list', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Single query with JOINs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            avatarType: true,
            examGoal: true,
            totalPoints: true,
            lastActive: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            avatarType: true,
            examGoal: true,
            totalPoints: true,
            lastActive: true,
          },
        },
      },
    });

    const friends = friendships.map((f) => {
      const friend = f.senderId === userId ? f.receiver : f.sender;
      return {
        friendshipId: f.id,
        ...friend,
      };
    });

    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

/**
 * OPTIMIZED: Send friend request
 * Uses transaction for atomicity
 */
router.post('/request', isAuthenticated, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // Single transaction for all checks and creation
    const result = await prisma.$transaction(async (tx) => {
      // Check block status
      const block = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: receiverId },
            { blockerId: receiverId, blockedId: senderId },
          ],
        },
      });

      if (block) {
        throw new Error('BLOCKED');
      }

      // Check existing friendship
      const existing = await tx.friendship.findFirst({
        where: {
          OR: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId },
          ],
        },
      });

      if (existing) {
        throw new Error('EXISTS');
      }

      // Create friendship
      return tx.friendship.create({
        data: {
          senderId,
          receiverId,
          status: 'PENDING',
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
        },
      });
    });

    res.json(result);
  } catch (error: any) {
    if (error.message === 'BLOCKED') {
      return res.status(403).json({ error: 'Cannot send friend request' });
    }
    if (error.message === 'EXISTS') {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

/**
 * Get friend requests (received) - Already efficient
 */
router.get('/requests', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    const requests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            avatarType: true,
            examGoal: true,
            totalPoints: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

/**
 * Accept friend request - Uses update with return
 */
router.put('/request/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Single query: update only if receiver matches
    const updated = await prisma.friendship.updateMany({
      where: { 
        id, 
        receiverId: userId,
        status: 'PENDING',
      },
      data: { status: 'ACCEPTED' },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

/**
 * Reject friend request
 */
router.put('/request/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await prisma.friendship.deleteMany({
      where: { 
        id, 
        receiverId: userId,
        status: 'PENDING',
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

/**
 * Unfriend
 */
router.delete('/:friendshipId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { friendshipId } = req.params;

    const deleted = await prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfriending:', error);
    res.status(500).json({ error: 'Failed to unfriend' });
  }
});

/**
 * Block user - Uses transaction
 */
router.post('/block', isAuthenticated, async (req, res) => {
  try {
    const blockerId = req.user!.id;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Transaction: remove friendship and create block atomically
    const block = await prisma.$transaction(async (tx) => {
      await tx.friendship.deleteMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: userId },
            { senderId: userId, receiverId: blockerId },
          ],
        },
      });

      return tx.block.create({
        data: {
          blockerId,
          blockedId: userId,
          reason,
        },
      });
    });

    res.json(block);
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * Unblock user
 */
router.delete('/block/:userId', isAuthenticated, async (req, res) => {
  try {
    const blockerId = req.user!.id;
    const { userId } = req.params;

    await prisma.block.deleteMany({
      where: {
        blockerId,
        blockedId: userId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/**
 * Get blocked users
 */
router.get('/blocked', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            avatarType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(blocks);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

export default router;
