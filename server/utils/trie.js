"use strict";
/**
 * Trie (Prefix Tree) implementation for fast username search
 * Time Complexity: O(m) where m is the length of the search string
 * Space Complexity: O(n*m) where n is number of users and m is avg username length
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.usernameTrie = exports.UsernameTrie = void 0;
class TrieNode {
    constructor() {
        this.children = new Map();
        this.isEndOfWord = false;
        this.userId = null;
        this.username = null;
    }
}
class UsernameTrie {
    constructor() {
        this.root = new TrieNode();
        this.userCache = new Map();
    }
    /**
     * Insert a username into the trie
     */
    insert(username, userId, userData) {
        const lowerUsername = username.toLowerCase();
        let node = this.root;
        for (const char of lowerUsername) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char);
        }
        node.isEndOfWord = true;
        node.userId = userId;
        node.username = username;
        this.userCache.set(userId, userData);
    }
    /**
     * Search for usernames with given prefix
     * Returns up to maxResults matching users
     */
    searchByPrefix(prefix, maxResults = 20) {
        const lowerPrefix = prefix.toLowerCase();
        let node = this.root;
        // Navigate to the prefix node
        for (const char of lowerPrefix) {
            if (!node.children.has(char)) {
                return []; // Prefix not found
            }
            node = node.children.get(char);
        }
        // Collect all users with this prefix
        const results = [];
        this.collectUsers(node, results, maxResults);
        return results;
    }
    /**
     * Check if username exists (exact match)
     */
    exists(username) {
        const lowerUsername = username.toLowerCase();
        let node = this.root;
        for (const char of lowerUsername) {
            if (!node.children.has(char)) {
                return false;
            }
            node = node.children.get(char);
        }
        return node.isEndOfWord;
    }
    /**
     * Generate username suggestions based on taken username
     */
    generateSuggestions(baseUsername, count = 5) {
        const suggestions = [];
        const lowerBase = baseUsername.toLowerCase();
        // Strategy 1: Add numbers
        for (let i = 1; i <= count && suggestions.length < count; i++) {
            const suggestion = `${lowerBase}${i}`;
            if (!this.exists(suggestion)) {
                suggestions.push(suggestion);
            }
        }
        // Strategy 2: Add random numbers
        if (suggestions.length < count) {
            for (let i = 0; i < count - suggestions.length; i++) {
                const randomNum = Math.floor(Math.random() * 9999);
                const suggestion = `${lowerBase}${randomNum}`;
                if (!this.exists(suggestion)) {
                    suggestions.push(suggestion);
                }
            }
        }
        // Strategy 3: Add underscores with numbers
        if (suggestions.length < count) {
            for (let i = 1; i <= count - suggestions.length; i++) {
                const suggestion = `${lowerBase}_${i}`;
                if (!this.exists(suggestion)) {
                    suggestions.push(suggestion);
                }
            }
        }
        // Strategy 4: Variations
        const variations = [
            `the_${lowerBase}`,
            `${lowerBase}_official`,
            `${lowerBase}_real`,
            `${lowerBase}x`,
            `${lowerBase}_`,
        ];
        for (const variation of variations) {
            if (suggestions.length >= count)
                break;
            if (!this.exists(variation)) {
                suggestions.push(variation);
            }
        }
        return suggestions.slice(0, count);
    }
    /**
     * Helper method to collect users from a node
     */
    collectUsers(node, results, maxResults) {
        if (results.length >= maxResults)
            return;
        if (node.isEndOfWord && node.userId) {
            const userData = this.userCache.get(node.userId);
            if (userData) {
                results.push(userData);
            }
        }
        // DFS to collect more users
        for (const [, childNode] of node.children) {
            if (results.length >= maxResults)
                break;
            this.collectUsers(childNode, results, maxResults);
        }
    }
    /**
     * Remove a username from the trie
     */
    remove(username) {
        const lowerUsername = username.toLowerCase();
        this.removeHelper(this.root, lowerUsername, 0);
    }
    removeHelper(node, username, index) {
        if (index === username.length) {
            if (!node.isEndOfWord)
                return false;
            node.isEndOfWord = false;
            if (node.userId) {
                this.userCache.delete(node.userId);
                node.userId = null;
                node.username = null;
            }
            return node.children.size === 0;
        }
        const char = username[index];
        const childNode = node.children.get(char);
        if (!childNode)
            return false;
        const shouldDeleteChild = this.removeHelper(childNode, username, index + 1);
        if (shouldDeleteChild) {
            node.children.delete(char);
            return node.children.size === 0 && !node.isEndOfWord;
        }
        return false;
    }
    /**
     * Clear the entire trie
     */
    clear() {
        this.root = new TrieNode();
        this.userCache.clear();
    }
    /**
     * Get the size of the trie (number of users)
     */
    size() {
        return this.userCache.size;
    }
}
exports.UsernameTrie = UsernameTrie;
// Singleton instance
exports.usernameTrie = new UsernameTrie();
