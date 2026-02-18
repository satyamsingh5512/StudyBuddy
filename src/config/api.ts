// API configuration
// For Capacitor native app: use full production URL (no local server on device)
// For production on Vercel: API routes are at /api on the same domain
// For development: use /api (Vite proxy to local server)
const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
export const API_URL = import.meta.env.VITE_API_URL || (isNativeApp ? 'https://sbd.satym.in/api' : '/api');

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

// Helper fetch function that automatically uses the API URL
export const apiFetch = (path: string, options?: RequestInit) =>
  fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

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
