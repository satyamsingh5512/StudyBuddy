/**
 * Server wakeup utility
 * Handles Render free-tier cold starts (can take ~30s)
 */

import { API_URL } from '../config/api';

let isAwake = false;

export const wakeupServer = async (): Promise<boolean> => {
  if (isAwake) return true;

  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
    });

    if (response.ok) {
      isAwake = true;
      return true;
    }
  } catch (error) {
    console.warn('Health check failed (server may be cold starting):', error);
  }

  // Still mark as awake — subsequent requests will handle retries
  isAwake = true;
  return true;
};

export const getServerStatus = () => ({ isAwake, isWakingUp: false });
export const resetServerStatus = () => { isAwake = false; };
