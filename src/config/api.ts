// API configuration
// Use same domain for API calls (Vercel will handle routing)
export const API_URL =
  (import.meta as any).env?.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin // Use same domain in production
    : 'http://localhost:3001');

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

// Helper fetch function that automatically uses the API URL
export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });
};
