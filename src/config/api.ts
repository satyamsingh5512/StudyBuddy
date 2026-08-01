/**
 * Shared API transport.
 *
 * Browser sessions are sent with credentials. React Query owns query caching
 * and active-query deduplication; writes are always sent independently.
 */

// Keep browser requests on the application origin. Next.js proxies this path to
// the backend, so auth cookies remain first-party even when the backend is hosted
// on another site (for example, Vercel in front of Render).
export const API_URL = '/api';

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
