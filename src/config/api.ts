/**
 * Shared API transport.
 *
 * Browser sessions are sent with credentials. React Query owns query caching
 * and active-query deduplication; writes are always sent independently.
 */

import { loadSnapshot, saveSnapshot } from '@/lib/offline/storage';

// Keep browser requests on the application origin. Next.js proxies this path to
// the backend, so auth cookies remain first-party even when the backend is hosted
// on another site (for example, Vercel in front of Render).
export const API_URL = '/api';

export const apiUrl = (path: string) => `${API_URL}${path}`;

const snapshotKey = (path: string) => `api:get:${path}`;

export class APIResponseError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'APIResponseError';
  }
}

const isOfflineTransportError = (error: unknown): boolean => {
  // HTTP responses, including a 401 delivered from a captive/offline network,
  // are authoritative rejections and must never fall back to an old snapshot.
  if (error instanceof APIResponseError) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return error instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(
    error instanceof Error ? error.message : String(error || '')
  );
};

export const apiFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const headers = new Headers(options?.headers);

  return fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  });
};

export const apiFetchJSON = async <T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options?.method || 'GET').toUpperCase();

  try {
    const response = await apiFetch(path, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new APIResponseError(
        response.status,
        error.error || error.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;
    if (method === 'GET') saveSnapshot(snapshotKey(path), data);
    return data;
  } catch (error) {
    // A cached response is deliberately never used for a server rejection
    // (401/403/4xx). It is only a local read fallback when transport failed.
    if (method === 'GET' && isOfflineTransportError(error)) {
      const snapshot = loadSnapshot<T>(snapshotKey(path));
      if (snapshot) return snapshot.data;
    }
    throw error;
  }
};

/**
 * Fetch a collection endpoint and guarantee an array result.
 *
 * List views render with `.map`, so a malformed or unexpected object payload
 * would otherwise throw during render and blank the page behind the error
 * boundary. Coercing here keeps that failure mode contained to empty state.
 */
export const apiFetchList = async <T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T[]> => {
  const data = await apiFetchJSON<unknown>(path, options);
  return Array.isArray(data) ? (data as T[]) : [];
};
