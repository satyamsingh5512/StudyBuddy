/**
 * Capacitor / native-platform helpers.
 *
 * Everything here is dynamic-import safe: the web bundle never statically
 * imports @capacitor/*, so `next build` works with or without native deps
 * installed. On the web this module degrades to localStorage + browser APIs.
 */

export const isBrowser = typeof window !== 'undefined';

export function isNativeApp(): boolean {
  if (!isBrowser) return false;
  try {
    const w = window as unknown as Record<string, unknown>;
    if (w.Capacitor && typeof (w.Capacitor as Record<string, unknown>).isNativePlatform === 'function') {
      return Boolean(
        ((w.Capacitor as Record<string, (...a: never[]) => unknown>).isNativePlatform as () => boolean)()
      );
    }
    return (window as Window & { Capacitor?: object }).Capacitor !== undefined &&
      navigator.userAgent.includes('Capacitor');
  } catch {
    return false;
  }
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isBrowser) return 'web';
  try {
    const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
    const p = w.Capacitor?.getPlatform?.();
    if (p === 'android' || p === 'ios') return p;
  } catch {
    /* ignore */
  }
  return 'web';
}

const DEVICE_ID_KEY = 'sb_device_id_v1';

export function getDeviceId(): string {
  if (!isBrowser) return 'server';
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Best-effort haptic feedback; no-op on web without native runtime. */
export async function hapticNotify(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const mod = await import('@capacitor/haptics').catch(() => null);
    if (mod) {
      await mod.Haptics.notification({ type: mod.NotificationType.Success }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

let wakeLockSentinel: { release: () => Promise<void> } | null = null;

/**
 * Keep the screen awake during local focus.
 * Uses the WakeLock API where available (Chrome, Android WebView) and
 * degrades to a no-op elsewhere — no extra native dependency required.
 */
export async function setKeepAwake(keepAwake: boolean): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
    };
    if (keepAwake) {
      if (nav.wakeLock?.request && !wakeLockSentinel) {
        wakeLockSentinel = await nav.wakeLock.request('screen').catch(() => null);
      }
    } else if (wakeLockSentinel) {
      await wakeLockSentinel.release().catch(() => undefined);
      wakeLockSentinel = null;
    }
  } catch {
    /* optional — ignore */
  }
}
