import { Router } from 'express';
import { usernameTrie } from '../utils/trie.js';
import { collections } from '../db/collections.js';
import { getDb } from '../db/client.js';

const router = Router();

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
