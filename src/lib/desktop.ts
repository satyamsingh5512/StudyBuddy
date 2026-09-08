/**
 * Desktop (Ubuntu Electron shell) detection + notification helpers.
 *
 * The renderer's single entry point for "notify the user like a native app":
 *  1. Inside the .deb / AppImage, route through the main process so the card
 *     is a real libnotify notification (works unfocused / minimized to tray).
 *  2. On the web, fall back to the Web Notification API when permitted.
 *
 * Everything is feature-detected — safe to import from any client component.
 */

export interface StudyBuddyDesktopBridge {
  readonly isDesktop: boolean;
  readonly platform?: string;
  notify(title: string, body: string, tag?: string): Promise<boolean>;
  setAutostart(enable: boolean): Promise<boolean>;
  getAutostart(): Promise<boolean>;
  keepAwake(enable: boolean): Promise<boolean>;
  setBadge(count: number): Promise<boolean>;
}

declare global {
  interface Window {
    studybuddy?: Partial<StudyBuddyDesktopBridge>;
  }
}

export function getDesktopBridge(): StudyBuddyDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.studybuddy;
  if (bridge?.isDesktop && typeof bridge.notify === 'function') {
    return bridge as StudyBuddyDesktopBridge;
  }
  return null;
}

export function isDesktopApp(): boolean {
  return getDesktopBridge() !== null;
}

/** In the desktop shell notifications are always available (libnotify). */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (isDesktopApp()) return 'granted';
  if (typeof window !== 'undefined' && 'Notification' in window) return Notification.permission;
  return 'unsupported';
}

/**
 * Notify like a native Ubuntu app. Resolves true when an OS-level card was
 * shown (desktop bridge or Web Notification), false when only in-app UI
 * should be used.
 */
export async function desktopNotify(title: string, body: string, tag?: string): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (bridge) {
    try {
      const ok = await bridge.notify(title, body, tag);
      if (ok) return true;
    } catch {
      /* fall through to Web Notification */
    }
  }
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        ...(tag ? { tag } : {}),
      });
      return true;
    }
  } catch {
    /* unsupported context — caller keeps the in-app toast */
  }
  return false;
}

/** Fire-and-forget variant for alarm loops that must never throw. */
export function desktopNotifySync(title: string, body: string, tag?: string): void {
  void desktopNotify(title, body, tag);
}

export async function setDesktopAutostart(enable: boolean): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  try {
    return await bridge.setAutostart(enable);
  } catch {
    return false;
  }
}

export async function getDesktopAutostart(): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  try {
    return await bridge.getAutostart();
  } catch {
    return false;
  }
}

/** Keep the display awake during focus sessions (desktop powerSaveBlocker). */
export async function setDesktopKeepAwake(enable: boolean): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  try {
    return await bridge.keepAwake(enable);
  } catch {
    return false;
  }
}
