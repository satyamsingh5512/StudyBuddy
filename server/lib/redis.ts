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

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

interface CachedMessage {
  id: string;
  userId: string;
  message: string;
  roomId: string;
  timestamp: number;
  userName?: string;
  userAvatar?: string;
}

interface OnlineUser {
  userId: string;
  socketId: string;
  joinedAt: number;
  lastSeen: number;
}

class RedisClient {
  private connected: boolean = false;
  private useRedis: boolean = false;
  
  // In-memory fallback stores
  private messageCache: Map<string, CachedMessage[]> = new Map();
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private userRooms: Map<string, Set<string>> = new Map();
  private messageQueue: CachedMessage[] = [];
  
  // Redis client (if available)
  private redisClient: any = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection
   * Falls back to in-memory if Redis is not available
   */
  private async initialize() {
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
      
      this.redisClient.on('error', (err: Error) => {
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

    } catch (error) {
      console.log('📦 Redis not available - using in-memory cache');
      this.useRedis = false;
      this.connected = true;
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Cache a message
   */
  async cacheMessage(roomId: string, message: CachedMessage): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        const key = `chat:messages:${roomId}`;
        await this.redisClient.lpush(key, JSON.stringify(message));
        await this.redisClient.ltrim(key, 0, 99); // Keep last 100 messages
        await this.redisClient.expire(key, 3600); // 1 hour TTL
      } catch (error) {
        console.error('Redis cache error:', error);
        this.cacheMessageInMemory(roomId, message);
      }
    } else {
      this.cacheMessageInMemory(roomId, message);
    }
    
    // Add to queue for batch persistence
    this.messageQueue.push(message);
  }

  /**
   * Cache message in memory (fallback)
   */
  private cacheMessageInMemory(roomId: string, message: CachedMessage): void {
    if (!this.messageCache.has(roomId)) {
      this.messageCache.set(roomId, []);
    }
    const messages = this.messageCache.get(roomId)!;
    messages.unshift(message);
    
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.splice(100);
    }
  }

  /**
   * Get cached messages for a room
   */
  async getCachedMessages(roomId: string, limit: number = 50): Promise<CachedMessage[]> {
    if (this.useRedis && this.redisClient) {
      try {
        const key = `chat:messages:${roomId}`;
        const messages = await this.redisClient.lrange(key, 0, limit - 1);
        return messages.map((msg: string) => JSON.parse(msg));
      } catch (error) {
        console.error('Redis get error:', error);
        return this.getCachedMessagesInMemory(roomId, limit);
      }
    } else {
      return this.getCachedMessagesInMemory(roomId, limit);
    }
  }

  /**
   * Get cached messages from memory (fallback)
   */
  private getCachedMessagesInMemory(roomId: string, limit: number): CachedMessage[] {
    const messages = this.messageCache.get(roomId) || [];
    return messages.slice(0, limit);
  }

  /**
   * Add user to online list
   */
  async addOnlineUser(userId: string, socketId: string): Promise<void> {
    const user: OnlineUser = {
      userId,
      socketId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.hset('chat:online', userId, JSON.stringify(user));
        await this.redisClient.expire('chat:online', 3600);
      } catch (error) {
        console.error('Redis online user error:', error);
        this.onlineUsers.set(userId, user);
      }
    } else {
      this.onlineUsers.set(userId, user);
    }
  }

  /**
   * Remove user from online list
   */
  async removeOnlineUser(userId: string): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.hdel('chat:online', userId);
      } catch (error) {
        console.error('Redis remove user error:', error);
        this.onlineUsers.delete(userId);
      }
    } else {
      this.onlineUsers.delete(userId);
    }
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<string[]> {
    if (this.useRedis && this.redisClient) {
      try {
        const users = await this.redisClient.hgetall('chat:online');
        return Object.keys(users);
      } catch (error) {
        console.error('Redis get online users error:', error);
        return Array.from(this.onlineUsers.keys());
      }
    } else {
      return Array.from(this.onlineUsers.keys());
    }
  }

  /**
   * Set user typing status
   */
  async setTyping(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        const key = `chat:typing:${roomId}`;
        if (isTyping) {
          await this.redisClient.sadd(key, userId);
          await this.redisClient.expire(key, 10); // 10 seconds TTL
        } else {
          await this.redisClient.srem(key, userId);
        }
      } catch (error) {
        console.error('Redis typing error:', error);
        this.setTypingInMemory(roomId, userId, isTyping);
      }
    } else {
      this.setTypingInMemory(roomId, userId, isTyping);
    }
  }

  /**
   * Set typing in memory (fallback)
   */
  private setTypingInMemory(roomId: string, userId: string, isTyping: boolean): void {
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }
    const typing = this.typingUsers.get(roomId)!;
    if (isTyping) {
      typing.add(userId);
      // Auto-remove after 10 seconds
      setTimeout(() => typing.delete(userId), 10000);
    } else {
      typing.delete(userId);
    }
  }

  /**
   * Get typing users for a room
   */
  async getTypingUsers(roomId: string): Promise<string[]> {
    if (this.useRedis && this.redisClient) {
      try {
        const key = `chat:typing:${roomId}`;
        return await this.redisClient.smembers(key);
      } catch (error) {
        console.error('Redis get typing error:', error);
        return Array.from(this.typingUsers.get(roomId) || []);
      }
    } else {
      return Array.from(this.typingUsers.get(roomId) || []);
    }
  }

  /**
   * Get message queue for batch persistence
   */
  getMessageQueue(): CachedMessage[] {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    return queue;
  }

  /**
   * Clear message queue
   */
  clearMessageQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    useRedis: boolean;
    connected: boolean;
    cachedRooms: number;
    onlineUsers: number;
    queuedMessages: number;
  } {
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
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();

export default redisClient;
