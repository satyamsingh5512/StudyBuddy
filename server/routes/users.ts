import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';
import { cache } from '../lib/cache.js';
import { sendWelcomeEmail } from '../lib/email.js';

const router = Router();

router.use(isAuthenticated);

router.get('/leaderboard', async (_req, res) => {
  try {
    const cacheKey = 'leaderboard:top10';

    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const users = await (await collections.users).find(
      { showProfile: true },
      {
        sort: { totalPoints: -1 },
        limit: 10,
        projection: {
          name: 1,
          username: 1,
          avatar: 1,
          avatarType: 1,
          totalPoints: 1,
          totalStudyMinutes: 1,
          streak: 1,
        }
      }
    ).toArray();

    const formattedUsers = users.map(u => ({ ...u, id: u._id }));

    cache.set(cacheKey, formattedUsers, 300);
    res.setHeader('X-Cache', 'MISS');
    res.json(formattedUsers);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const userId = req.user!._id;
    const updateData = { ...req.body, updatedAt: new Date() };

    await (await collections.users).updateOne(
      { _id: userId },
      { $set: updateData }
    );

    const updatedUser = await (await collections.users).findOne({ _id: userId });

    cache.delete(`user:${userId.toString()}`);
    cache.delete('leaderboard:top10');

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/onboarding', async (req, res) => {
  try {
    const { username, avatarType, avatar, examGoal, studentClass, batch, examAttempt, examDate } = req.body;
    const userId = req.user!._id;

    if (username) {
      const existing = await (await collections.users).findOne(
        { username },
        { projection: { _id: 1 } }
      );

      if (existing && existing._id.toString() !== userId.toString()) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const parsedExamDate = examDate ? new Date(examDate) : null;

    await (await collections.users).updateOne(
      { _id: userId },
      {
        $set: {
          username,
          avatarType,
          avatar,
          examGoal,
          studentClass,
          batch,
          examAttempt,
          examDate: parsedExamDate,
          onboardingDone: true,
          updatedAt: new Date()
        }
      }
    );

    const user = await (await collections.users).findOne({ _id: userId });

    console.log(`✅ Onboarding completed for ${user!.email}:`, {
      examGoal,
      examDate: parsedExamDate?.toISOString().split('T')[0],
      batch,
    });

    cache.delete(`user:${userId.toString()}`);
    cache.delete('leaderboard:top10');

    sendWelcomeEmail(user!.email, user!.name).catch(() => {
      // Silently handle email errors
    });

    res.json(user);
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

/**
 * PATCH /api/users/avatar-url
 * Save an external avatar URL (e.g. Google photo) directly without file upload
 */
router.patch('/avatar-url', async (req, res) => {
  try {
    const { avatarUrl, avatarType = 'google' } = req.body;
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl is required' });
    }

    const userId = (req.user as any)._id;

    await (await collections.users).updateOne(
      { _id: userId },
      { $set: { avatar: avatarUrl, avatarType, updatedAt: new Date() } }
    );

    const updated = await (await collections.users).findOne({ _id: userId });
    cache.delete(`user:${userId.toString()}`);

    res.json(updated);
  } catch (error) {
    console.error('Avatar URL update error:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

export default router;
