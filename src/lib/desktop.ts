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

export interface DesktopTimerState {
  studying: boolean;
  studyTime: number;
  pomodoroDuration: number;
  unlimited: boolean;
  sessionStart: string | null;
  pendingSaves?: DesktopTimerSaveRequest[];
}

export interface DesktopTimerSaveRequest {
  id: string;
  minutes: number;
  reason: string;
  startTime: string | null;
  endTime: string;
}

export interface StudyBuddyDesktopBridge {
  readonly isDesktop: boolean;
  readonly platform?: string;
  notify(title: string, body: string, tag?: string): Promise<boolean>;
  setAutostart(enable: boolean): Promise<boolean>;
  getAutostart(): Promise<boolean>;
  keepAwake(enable: boolean): Promise<boolean>;
  setBadge(count: number): Promise<boolean>;
  getTimer(): Promise<DesktopTimerState | null>;
  timerSaveAck(id: string): Promise<boolean>;
  timerSync(state: Partial<DesktopTimerState>): Promise<DesktopTimerState | null>;
  timerControl(action: string, payload?: Record<string, unknown>): Promise<DesktopTimerState | null>;
  onTimerUpdate(cb: (state: DesktopTimerState) => void): () => void;
  onTimerSaveRequest(cb: (payload: DesktopTimerSaveRequest) => void): () => void;
  onTimerComplete(cb: (payload: { minutes: number; pomodoroDuration: number }) => void): () => void;
  setWidgetMode(mode: 'dot' | 'expanded'): Promise<boolean>;
  showMain(route?: string): Promise<boolean>;
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

// ---------------------------------------------------------------------------
// OS-wide floating widget timer helpers
// ---------------------------------------------------------------------------

/** Get current timer state from the main process. */
export async function getDesktopTimer(): Promise<DesktopTimerState | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  try {
    return await bridge.getTimer();
  } catch {
    return null;
  }
}

/**
 * Push renderer timer config to the main process so the widget and tick
 * stay in sync. Call this when the user changes pomodoro duration,
 * unlimited mode, or selected subject.
 */
export async function syncDesktopTimer(state: Partial<DesktopTimerState>): Promise<DesktopTimerState | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  try {
    return await bridge.timerSync(state);
  } catch {
    return null;
  }
}

/** Acknowledge a desktop session after it has been durably saved or queued. */
export async function acknowledgeDesktopTimerSave(id: string): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  try {
    return await bridge.timerSaveAck(id);
  } catch {
    return false;
  }
}

/** Send a control action (start / pause / reset / stop-and-save) to the main process timer. */
export async function controlDesktopTimer(action: string, payload?: Record<string, unknown>): Promise<DesktopTimerState | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  try {
    return await bridge.timerControl(action, payload);
  } catch {
    return null;
  }
}

/**
 * Subscribe to timer ticks from the main process. Returns an unsubscribe
 * function. The callback receives the full timer state every second while
 * studying, and once on any state change.
 */
export function onDesktopTimerUpdate(cb: (state: DesktopTimerState) => void): () => void {
  const bridge = getDesktopBridge();
  if (!bridge) return () => {};
  return bridge.onTimerUpdate(cb);
}

/**
 * Subscribe to "save session" requests from the main process (fires when
 * the pomodoro completes or the user clicks "Save & Exit" in the widget).
 */
export function onDesktopTimerSaveRequest(cb: (payload: DesktopTimerSaveRequest) => void): () => void {
  const bridge = getDesktopBridge();
  if (!bridge) return () => {};
  return bridge.onTimerSaveRequest(cb);
}

/**
 * Subscribe to pomodoro completion events from the main process.
 * The web UI should show a toast / save the session in response.
 */
export function onDesktopTimerComplete(cb: (payload: { minutes: number; pomodoroDuration: number }) => void): () => void {
  const bridge = getDesktopBridge();
  if (!bridge) return () => {};
  return bridge.onTimerComplete(cb);
}
