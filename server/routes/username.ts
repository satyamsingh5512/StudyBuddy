import { Router } from 'express';
import { usernameTrie } from '../utils/trie.js';
import { collections } from '../db/collections.js';
import { getDb } from '../db/client.js';

const router = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * GET /api/username/check/:username
 * Public endpoint — no auth required (called during onboarding before user has a session).
 * Checks availability using the in-memory trie with a DB fallback.
 */
router.get('/check/:username', async (req, res) => {
  const { username } = req.params;

  // Format validation
  if (!username || username.length < 3) {
    return res.json({ available: false, message: 'Username must be at least 3 characters' });
  }
  if (username.length > 20) {
    return res.json({ available: false, message: 'Username must be less than 20 characters' });
  }
  if (!USERNAME_REGEX.test(username)) {
    return res.json({ available: false, message: 'Only letters, numbers, and underscores allowed' });
  }

  try {
    // Primary check: in-memory trie (O(m), very fast)
    const takenInTrie = usernameTrie.exists(username);

    if (takenInTrie) {
      const suggestions = usernameTrie.generateSuggestions(username);
      return res.json({
        available: false,
        message: `@${username} is already taken`,
        suggestions,
      });
    }

    // Fallback check: database (handles edge case where trie isn't warm yet)
    const existing = await (await collections.users).findOne(
      { username: { $regex: new RegExp(`^${username}$`, 'i') } },
      { projection: { _id: 1 } },
    );

    if (existing) {
      const suggestions = usernameTrie.generateSuggestions(username);
      return res.json({
        available: false,
        message: `@${username} is already taken`,
        suggestions,
      });
    }

    return res.json({ available: true, message: `@${username} is available!` });
  } catch (error) {
    console.error('❌ Username check error:', error);
    return res.status(500).json({ available: false, message: 'Could not check username, please try again' });
  }
});

let trieInitialized = false;

async function initializeTrie() {
  if (trieInitialized) return;

  try {
    console.log('🔄 Initializing username trie...');

    const db = await getDb();
    if (!db) {
      console.log('⚠️  MongoDB not connected, skipping trie initialization');
      return;
    }

    const users = await (await collections.users).find(
      { username: { $exists: true, $ne: '' as any } },
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

    usernameTrie.clear();
    users.forEach((user) => {
      if (user.username) {
        usernameTrie.insert(user.username, user._id.toString(), {
          id: user._id.toString(),
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          avatarType: user.avatarType,
          examGoal: user.examGoal,
          totalPoints: user.totalPoints,
        });
      }
    });

    trieInitialized = true;
    console.log(`✅ Trie initialized with ${users.length} users`);
  } catch (error) {
    console.error('❌ Error initializing trie:', error);
  }
}

initializeTrie();

export async function addUserToTrie(username: string, userId: string, userData: any) {
  usernameTrie.insert(username, userId, userData);
}

export async function removeUserFromTrie(username: string) {
  usernameTrie.remove(username);
}

export default router;
