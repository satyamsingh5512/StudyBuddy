/**
 * API Configuration
 *
 * Vercel deployment and local development both use Next.js API routes at /api.
 * Optional override with NEXT_PUBLIC_API_URL if you intentionally host API elsewhere.
 *
 * JWT tokens are stored in HttpOnly cookies (web) — credentials: 'include' handles them.
 */
const PROD_FALLBACK_API_URL = 'https://studybuddy-go-backend.onrender.com/api';
const DEFAULT_API_URL = process.env.NODE_ENV === 'production' ? PROD_FALLBACK_API_URL : '/api';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

export const apiFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options?.headers);
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  return response;
};

// Helper fetch function that automatically parses JSON responses
export const apiFetchJSON = async <T = any>(path: string, options?: RequestInit): Promise<T> => {
  const response = await apiFetch(path, {
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
