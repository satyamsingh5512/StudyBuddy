import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { usernameTrie } from '../utils/trie';

const router = Router();
const prisma = new PrismaClient();

// Initialize trie on server start
let trieInitialized = false;

async function initializeTrie() {
  if (trieInitialized) return;

  try {
    console.log('🔄 Initializing username trie...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        avatarType: true,
        examGoal: true,
        totalPoints: true,
      },
    });

    usernameTrie.clear();
    users.forEach((user) => {
      if (user.username) {
        usernameTrie.insert(user.username, user.id, user);
      }
    });

    trieInitialized = true;
    console.log(`✅ Trie initialized with ${users.length} users`);
  } catch (error) {
    console.error('❌ Error initializing trie:', error);
  }
}

// Initialize on module load
initializeTrie();

// Check username availability (instant)
router.get('/check/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.json({
        available: false,
        message: 'Username must be at least 3 characters',
      });
    }

    if (username.length > 20) {
      return res.json({
        available: false,
        message: 'Username must be less than 20 characters',
      });
    }

    // Check if username contains only valid characters
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(username)) {
      return res.json({
        available: false,
        message: 'Username can only contain letters, numbers, and underscores',
      });
    }

    // Fast check using trie
    const exists = usernameTrie.exists(username);

    if (exists) {
      // Generate suggestions
      const suggestions = usernameTrie.generateSuggestions(username, 5);
      return res.json({
        available: false,
        message: 'Username is already taken',
        suggestions,
      });
    }

    res.json({
      available: true,
      message: 'Username is available',
    });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// Fast search users by username prefix
router.get('/search/fast', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    if (q.length < 2) {
      return res.json([]);
    }

    // Ensure trie is initialized
    if (!trieInitialized) {
      await initializeTrie();
    }

    // Fast prefix search using trie
    const results = usernameTrie.searchByPrefix(q, 20);

    // Filter out current user if authenticated
    const userId = (req as any).user?.id;
    const filtered = userId
      ? results.filter((user) => user.id !== userId)
      : results;

    res.json(filtered);
  } catch (error) {
    console.error('Error in fast search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Update trie when new user is created (called from auth routes)
export async function addUserToTrie(username: string, userId: string, userData: any) {
  usernameTrie.insert(username, userId, userData);
}

// Remove user from trie
export async function removeUserFromTrie(username: string) {
  usernameTrie.remove(username);
}

// Refresh trie (useful for admin operations)
router.post('/refresh-trie', async (req, res) => {
  try {
    trieInitialized = false;
    await initializeTrie();
    res.json({ success: true, size: usernameTrie.size() });
  } catch (error) {
    console.error('Error refreshing trie:', error);
    res.status(500).json({ error: 'Failed to refresh trie' });
  }
});

export default router;
