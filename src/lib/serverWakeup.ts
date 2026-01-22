/**
 * Server wakeup utility
 * Simplified for Vercel deployment (no cold starts like Render)
 */

let isAwake = false;

export const wakeupServer = async (): Promise<boolean> => {
  if (isAwake) return true;

  try {
    const response = await fetch('/api/health', {
      method: 'GET',
    });

    if (response.ok) {
      isAwake = true;
      return true;
    }
  } catch (error) {
    console.warn('Health check failed:', error);
  }

  // Even if health check fails, continue (Vercel functions start fast)
  isAwake = true;
  return true;
};

export const getServerStatus = () => ({ isAwake, isWakingUp: false });
export const resetServerStatus = () => { isAwake = false; };
