"use strict";
/**
 * Redis Client for Chat Caching
 * File: server/lib/redis.ts
 *
 * Provides in-memory caching for:
 * - Recent chat messages
 * - Online users
 * - Typing indicators
 * - Active rooms
 *
 * Falls back to in-memory Map if Redis is not available
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
class RedisClient {
    constructor() {
        this.connected = false;
        this.useRedis = false;
        // In-memory fallback stores
        this.messageCache = new Map();
        this.onlineUsers = new Map();
        this.typingUsers = new Map();
        this.userRooms = new Map();
        this.messageQueue = [];
        // Redis client (if available)
        this.redisClient = null;
        this.initialize();
    }
    /**
     * Initialize Redis connection
     * Falls back to in-memory if Redis is not available
     */
    async initialize() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.log('📦 Redis not configured - using in-memory cache');
            this.useRedis = false;
            this.connected = true;
            return;
        }
        try {
            // Try to import ioredis (optional dependency)
            const Redis = require('ioredis');
            this.redisClient = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: true,
            });
            await this.redisClient.connect();
            this.redisClient.on('error', (err) => {
                console.error('❌ Redis error:', err.message);
                this.useRedis = false;
            });
            this.redisClient.on('connect', () => {
                console.log('✅ Redis connected');
                this.useRedis = true;
                this.connected = true;
            });
            this.redisClient.on('disconnect', () => {
                console.warn('⚠️  Redis disconnected - falling back to in-memory');
                this.useRedis = false;
            });
        }
        catch (error) {
            console.log('📦 Redis not available - using in-memory cache');
            this.useRedis = false;
            this.connected = true;
        }
    }
    /**
     * Check if Redis is connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Cache a message
     */
    async cacheMessage(roomId, message) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:messages:${roomId}`;
                await this.redisClient.lpush(key, JSON.stringify(message));
                await this.redisClient.ltrim(key, 0, 99); // Keep last 100 messages
                await this.redisClient.expire(key, 3600); // 1 hour TTL
            }
            catch (error) {
                console.error('Redis cache error:', error);
                this.cacheMessageInMemory(roomId, message);
            }
        }
        else {
            this.cacheMessageInMemory(roomId, message);
        }
        // Add to queue for batch persistence
        this.messageQueue.push(message);
    }
    /**
     * Cache message in memory (fallback)
     */
    cacheMessageInMemory(roomId, message) {
        if (!this.messageCache.has(roomId)) {
            this.messageCache.set(roomId, []);
        }
        const messages = this.messageCache.get(roomId);
        messages.unshift(message);
        // Keep only last 100 messages
        if (messages.length > 100) {
            messages.splice(100);
        }
    }
    /**
     * Get cached messages for a room
     */
    async getCachedMessages(roomId, limit = 50) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:messages:${roomId}`;
                const messages = await this.redisClient.lrange(key, 0, limit - 1);
                return messages.map((msg) => JSON.parse(msg));
            }
            catch (error) {
                console.error('Redis get error:', error);
                return this.getCachedMessagesInMemory(roomId, limit);
            }
        }
        else {
            return this.getCachedMessagesInMemory(roomId, limit);
        }
    }
    /**
     * Get cached messages from memory (fallback)
     */
    getCachedMessagesInMemory(roomId, limit) {
        const messages = this.messageCache.get(roomId) || [];
        return messages.slice(0, limit);
    }
    /**
     * Remove a message from cache
     */
    async removeMessage(roomId, messageId) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:messages:${roomId}`;
                const messages = await this.redisClient.lrange(key, 0, -1);
                // Filter out the message to delete
                const filtered = messages.filter((msg) => {
                    const parsed = JSON.parse(msg);
                    return parsed.id !== messageId;
                });
                // Clear and repopulate the list
                await this.redisClient.del(key);
                if (filtered.length > 0) {
                    await this.redisClient.rpush(key, ...filtered);
                    await this.redisClient.expire(key, 3600);
                }
            }
            catch (error) {
                console.error('Redis remove message error:', error);
                this.removeMessageInMemory(roomId, messageId);
            }
        }
        else {
            this.removeMessageInMemory(roomId, messageId);
        }
        // Also remove from message queue if it's there
        this.messageQueue = this.messageQueue.filter(m => m.id !== messageId);
    }
    /**
     * Remove message from memory (fallback)
     */
    removeMessageInMemory(roomId, messageId) {
        const messages = this.messageCache.get(roomId);
        if (messages) {
            const filtered = messages.filter(m => m.id !== messageId);
            this.messageCache.set(roomId, filtered);
        }
    }
    /**
     * Update a message in cache
     */
    async updateMessage(roomId, messageId, newMessage) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:messages:${roomId}`;
                const messages = await this.redisClient.lrange(key, 0, -1);
                // Update the message
                const updated = messages.map((msg) => {
                    const parsed = JSON.parse(msg);
                    if (parsed.id === messageId) {
                        parsed.message = newMessage;
                    }
                    return JSON.stringify(parsed);
                });
                // Clear and repopulate the list
                await this.redisClient.del(key);
                if (updated.length > 0) {
                    await this.redisClient.rpush(key, ...updated);
                    await this.redisClient.expire(key, 3600);
                }
            }
            catch (error) {
                console.error('Redis update message error:', error);
                this.updateMessageInMemory(roomId, messageId, newMessage);
            }
        }
        else {
            this.updateMessageInMemory(roomId, messageId, newMessage);
        }
        // Also update in message queue if it's there
        this.messageQueue = this.messageQueue.map(m => {
            if (m.id === messageId) {
                return { ...m, message: newMessage };
            }
            return m;
        });
    }
    /**
     * Update message in memory (fallback)
     */
    updateMessageInMemory(roomId, messageId, newMessage) {
        const messages = this.messageCache.get(roomId);
        if (messages) {
            const updated = messages.map(m => {
                if (m.id === messageId) {
                    return { ...m, message: newMessage };
                }
                return m;
            });
            this.messageCache.set(roomId, updated);
        }
    }
    /**
     * Add user to online list
     */
    async addOnlineUser(userId, socketId) {
        const user = {
            userId,
            socketId,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
        };
        if (this.useRedis && this.redisClient) {
            try {
                await this.redisClient.hset('chat:online', userId, JSON.stringify(user));
                await this.redisClient.expire('chat:online', 3600);
            }
            catch (error) {
                console.error('Redis online user error:', error);
                this.onlineUsers.set(userId, user);
            }
        }
        else {
            this.onlineUsers.set(userId, user);
        }
    }
    /**
     * Remove user from online list
     */
    async removeOnlineUser(userId) {
        if (this.useRedis && this.redisClient) {
            try {
                await this.redisClient.hdel('chat:online', userId);
            }
            catch (error) {
                console.error('Redis remove user error:', error);
                this.onlineUsers.delete(userId);
            }
        }
        else {
            this.onlineUsers.delete(userId);
        }
    }
    /**
     * Get all online users
     */
    async getOnlineUsers() {
        if (this.useRedis && this.redisClient) {
            try {
                const users = await this.redisClient.hgetall('chat:online');
                return Object.keys(users);
            }
            catch (error) {
                console.error('Redis get online users error:', error);
                return Array.from(this.onlineUsers.keys());
            }
        }
        else {
            return Array.from(this.onlineUsers.keys());
        }
    }
    /**
     * Set user typing status
     */
    async setTyping(roomId, userId, isTyping) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:typing:${roomId}`;
                if (isTyping) {
                    await this.redisClient.sadd(key, userId);
                    await this.redisClient.expire(key, 10); // 10 seconds TTL
                }
                else {
                    await this.redisClient.srem(key, userId);
                }
            }
            catch (error) {
                console.error('Redis typing error:', error);
                this.setTypingInMemory(roomId, userId, isTyping);
            }
        }
        else {
            this.setTypingInMemory(roomId, userId, isTyping);
        }
    }
    /**
     * Set typing in memory (fallback)
     */
    setTypingInMemory(roomId, userId, isTyping) {
        if (!this.typingUsers.has(roomId)) {
            this.typingUsers.set(roomId, new Set());
        }
        const typing = this.typingUsers.get(roomId);
        if (isTyping) {
            typing.add(userId);
            // Auto-remove after 10 seconds
            setTimeout(() => typing.delete(userId), 10000);
        }
        else {
            typing.delete(userId);
        }
    }
    /**
     * Get typing users for a room
     */
    async getTypingUsers(roomId) {
        if (this.useRedis && this.redisClient) {
            try {
                const key = `chat:typing:${roomId}`;
                return await this.redisClient.smembers(key);
            }
            catch (error) {
                console.error('Redis get typing error:', error);
                return Array.from(this.typingUsers.get(roomId) || []);
            }
        }
        else {
            return Array.from(this.typingUsers.get(roomId) || []);
        }
    }
    /**
     * Get message queue for batch persistence
     */
    getMessageQueue() {
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        return queue;
    }
    /**
     * Clear message queue
     */
    clearMessageQueue() {
        this.messageQueue = [];
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            useRedis: this.useRedis,
            connected: this.connected,
            cachedRooms: this.messageCache.size,
            onlineUsers: this.onlineUsers.size,
            queuedMessages: this.messageQueue.length,
        };
    }
    /**
     * Close Redis connection
     */
    async close() {
        if (this.redisClient) {
            await this.redisClient.quit();
        }
    }
}
// Export singleton instance
exports.redisClient = new RedisClient();
exports.default = exports.redisClient;
