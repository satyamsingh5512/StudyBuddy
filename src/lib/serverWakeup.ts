import { API_URL } from '@/config/api';

/**
 * Server wakeup utility for handling Render free tier cold starts
 * Pings the server health endpoint to wake it up if it's sleeping
 */

let isWakingUp = false;
let isAwake = false;

export const wakeupServer = async (): Promise<boolean> => {
  // If already awake or currently waking up, skip
  if (isAwake || isWakingUp) {
    return isAwake;
  }

  isWakingUp = true;

  try {
    console.log('🔄 Checking server status...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
      method: 'GET',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ Server is awake and ready');
      isAwake = true;
      isWakingUp = false;
      return true;
    }
  } catch (error) {
    console.warn('⚠️ Server wakeup check failed:', error);
  }

  isWakingUp = false;
  return false;
};

/**
 * Enhanced fetch wrapper that handles server cold starts
 * Automatically retries if server is waking up
 */
export const fetchWithWakeup = async (
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // On first attempt, ensure server is awake
      if (attempt === 1 && !isAwake) {
        await wakeupServer();
      }

      const response = await fetch(url, options);

      // If successful, mark server as awake
      if (response.ok || response.status < 500) {
        isAwake = true;
        return response;
      }

      // Server error, might be waking up
      if (response.status >= 500 && attempt < maxRetries) {
        console.log(`⏳ Server might be waking up, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Network error, server might be cold starting
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting for server to wake up (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Exponential backoff
        continue;
      }
    }
  }

  throw lastError || new Error('Server request failed after retries');
};

/**
 * Get server status
 */
export const getServerStatus = () => ({
  isAwake,
  isWakingUp,
});

/**
 * Reset server status (useful for testing)
 */
export const resetServerStatus = () => {
  isAwake = false;
  isWakingUp = false;
};
