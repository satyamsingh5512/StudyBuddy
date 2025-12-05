import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Search users by username
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Find users matching the search query (excluding current user)
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
      take: 20,
    });

    // Check friendship status and blocks for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        // Check if blocked
        const isBlocked = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: user.id },
              { blockerId: user.id, blockedId: userId },
            ],
          },
        });

        if (isBlocked) {
          return null; // Don't show blocked users
        }

        // Check friendship status
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: user.id },
              { senderId: user.id, receiverId: userId },
            ],
          },
        });

        return {
          ...user,
          friendshipStatus: friendship?.status || null,
          isSender: friendship?.senderId === userId,
        };
      })
    );

    res.json(usersWithStatus.filter(Boolean));
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Send friend request
router.post('/request', isAuthenticated, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // Check if users are blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot send friend request' });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const friendship = await prisma.friendship.create({
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

    res.json(friendship);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Get friend requests (received)
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

// Accept friend request
router.put('/request/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship || friendship.receiverId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject friend request
router.put('/request/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship || friendship.receiverId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await prisma.friendship.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// Get friends list
router.get('/list', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

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

// Unfriend
router.delete('/:friendshipId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { friendshipId } = req.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfriending:', error);
    res.status(500).json({ error: 'Failed to unfriend' });
  }
});

// Block user
router.post('/block', isAuthenticated, async (req, res) => {
  try {
    const blockerId = req.user!.id;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Remove any existing friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { senderId: blockerId, receiverId: userId },
          { senderId: userId, receiverId: blockerId },
        ],
      },
    });

    // Create block
    const block = await prisma.block.create({
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

// Unblock user
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

// Get blocked users
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
