/**
 * API Configuration
 *
 * Web (Vercel): API is at https://api.satym.in (separate Render service)
 * Native (Capacitor): API is at https://api.satym.in
 * Development: API is at /api (Vite proxy) or override with VITE_API_URL
 *
 * JWT tokens are stored in HttpOnly cookies (web) — credentials: 'include' handles them.
 * The apiFetch wrapper automatically retries with a token refresh on 401.
 */
import { isNativePlatform } from '../lib/capacitor';

const isNativeApp = isNativePlatform();

// In development, /api is proxied by Vite to localhost:3001
// In production/native, use the Render-hosted API with /api prefix
const DEFAULT_API_URL = import.meta.env.DEV && !isNativeApp
  ? '/api'
  : 'https://studybuddy-api-s1bx.onrender.com/api';

export const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

export const apiFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
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
