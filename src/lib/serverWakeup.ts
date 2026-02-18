/**
 * Server wakeup utility
 * Simplified for Vercel deployment (no cold starts like Render)
 */

let isAwake = false;

export const wakeupServer = async (): Promise<boolean> => {
  if (isAwake) return true;

  try {
    const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    const healthUrl = isNative ? 'https://sbd.satym.in/api/health' : '/api/health';
    const response = await fetch(healthUrl, {
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
