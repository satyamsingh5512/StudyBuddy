/**
 * Shared API transport.
 *
 * Browser sessions are sent with credentials. React Query owns query caching
 * and active-query deduplication; writes are always sent independently.
 */

const PROD_FALLBACK_API_URL = 'https://studybuddy-go-backend.onrender.com/api';
const DEV_FALLBACK_API_URL = 'http://localhost:8080/api';
const DEFAULT_API_URL =
  process.env.NODE_ENV === 'production' ? PROD_FALLBACK_API_URL : DEV_FALLBACK_API_URL;

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export const apiUrl = (path: string) => `${API_URL}${path}`;

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

  const response = await apiFetch(path, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(
      error.error || error.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};
