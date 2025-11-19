// API configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to build API URLs
export const apiUrl = (path: string) => `${API_URL}${path}`;

// Helper fetch function that automatically uses the API URL
export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });
};
