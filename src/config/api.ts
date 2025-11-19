// API configuration
// In production, VITE_API_URL should be set to your backend URL
// If not set, it will try localhost (which won't work in production)
export const API_URL =
  (import.meta as any).env?.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? '' // Empty string will cause immediate failure in production without backend
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
