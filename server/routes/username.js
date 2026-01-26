"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserToTrie = addUserToTrie;
exports.removeUserFromTrie = removeUserFromTrie;
const express_1 = require("express");
const trie_1 = require("../utils/trie");
const mongodb_1 = require("../lib/mongodb");
const router = (0, express_1.Router)();
// Initialize trie on server start
let trieInitialized = false;
async function initializeTrie() {
    if (trieInitialized)
        return;
    try {
        console.log('🔄 Initializing username trie...');
        const db = await (0, mongodb_1.getMongoDb)();
        if (!db) {
            console.log('⚠️  MongoDB not connected, skipping trie initialization');
            return;
        }
        const users = await db.collection('users').find({ username: { $exists: true, $ne: null } }, {
            projection: {
                _id: 1,
                username: 1,
                name: 1,
                avatar: 1,
                avatarType: 1,
                examGoal: 1,
                totalPoints: 1,
            }
        }).toArray();
        trie_1.usernameTrie.clear();
        users.forEach((user) => {
            if (user.username) {
                trie_1.usernameTrie.insert(user.username, user._id.toString(), {
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
    }
    catch (error) {
        console.error('❌ Error initializing trie:', error);
        // Don't throw - allow server to start even if trie init fails
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
        const exists = trie_1.usernameTrie.exists(username);
        if (exists) {
            // Generate suggestions
            const suggestions = trie_1.usernameTrie.generateSuggestions(username, 5);
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
    }
    catch (error) {
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
        const results = trie_1.usernameTrie.searchByPrefix(q, 20);
        // Filter out current user if authenticated
        const userId = req.user?.id;
        const filtered = userId
            ? results.filter((user) => user.id !== userId)
            : results;
        res.json(filtered);
    }
    catch (error) {
        console.error('Error in fast search:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});
// Update trie when new user is created (called from auth routes)
async function addUserToTrie(username, userId, userData) {
    trie_1.usernameTrie.insert(username, userId, userData);
}
// Remove user from trie
async function removeUserFromTrie(username) {
    trie_1.usernameTrie.remove(username);
}
// Refresh trie (useful for admin operations)
router.post('/refresh-trie', async (req, res) => {
    try {
        trieInitialized = false;
        await initializeTrie();
        res.json({ success: true, size: trie_1.usernameTrie.size() });
    }
    catch (error) {
        console.error('Error refreshing trie:', error);
        res.status(500).json({ error: 'Failed to refresh trie' });
    }
});
exports.default = router;
