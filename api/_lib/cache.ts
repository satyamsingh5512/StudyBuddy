/**
 * Simple in-memory cache for Vercel Serverless
 * Note: Cache is per-instance, not shared across invocations
 * For production, consider using Vercel KV or Redis
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function get<T>(key: string): T | null {
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

export function set<T>(key: string, data: T, ttlSeconds: number = 300): void {
  cache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000),
  });
}

export function del(key: string): void {
  cache.delete(key);
}

export function clear(): void {
  cache.clear();
}

export function invalidatePattern(pattern: string): void {
  const keys = Array.from(cache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  });
}

export default { get, set, del, clear, invalidatePattern };
