import { apiCache } from '@/lib/performance';

// API configuration for Vercel deployment
// Both frontend and backend are on the same domain
export const API_URL = '';  // Empty string = same origin (Vercel serverless)

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

// Helper fetch function that automatically uses the API URL
export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });
};

// Helper fetch function with caching support for GET requests
export const apiFetchCached = async (
  path: string,
  options?: RequestInit & { cacheTTL?: number; bypassCache?: boolean }
): Promise<Response> => {
  const { cacheTTL, bypassCache, ...fetchOptions } = options || {};
  const method = fetchOptions.method?.toUpperCase() || 'GET';
  const cacheKey = `${method}:${path}`;

  // Only cache GET requests
  if (method === 'GET' && !bypassCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...fetchOptions,
  });

  // Cache successful GET responses
  if (method === 'GET' && response.ok) {
    const data = await response.clone().json();
    apiCache.set(cacheKey, data, cacheTTL);
  }

  return response;
};

// Helper fetch function that automatically parses JSON responses
export const apiFetchJSON = async <T = any>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};
