/**
 * Offline storage layer.
 *
 * Phase 1: localStorage-backed (works on web + inside the Capacitor WebView,
 * which is the APK's internal memory). Keys are versioned so future
 * IndexedDB/Preferences migrations can run side-by-side.
 *
 * All helpers are synchronous-safe and never throw — offline code paths must
 * not crash the UI when storage is full or unavailable (private mode, etc).
 */

const isBrowser = typeof window !== 'undefined';

function safeGet(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full/blocked — offline queue degrades gracefully */
  }
}

function safeRemove(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    safeSet(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeKey(key: string): void {
  safeRemove(key);
}

/** Last-known-good read snapshots, so lists still render while offline. */
const SNAPSHOT_PREFIX = 'sb_snapshot_v1:';
const OFFLINE_ACCOUNT_KEY = 'sb_offline_account_v1';
const ACCOUNT_DATA_KEYS = new Set([
  'sb_outbox_v1',
  'offlineQueue', // legacy queue from releases before the idempotent outbox
  'sb_focus_local_v1',
  'sb_focus_pending_v1',
  'sb_device_id_v1',
  'sb_timer_session_start_v1',
  OFFLINE_ACCOUNT_KEY,
]);

export function saveSnapshot<T>(name: string, data: T): void {
  writeJSON(`${SNAPSHOT_PREFIX}${name}`, { savedAt: Date.now(), data });
}

export function loadSnapshot<T>(name: string): { savedAt: number; data: T } | null {
  const raw = readJSON<{ savedAt: number; data: T } | null>(`${SNAPSHOT_PREFIX}${name}`, null);
  return raw && typeof raw === 'object' && 'data' in raw ? raw : null;
}

export function snapshotAgeMs(name: string): number | null {
  const snap = loadSnapshot<unknown>(name);
  return snap ? Date.now() - snap.savedAt : null;
}

/** Marks that this browser/WebView has an authenticated account eligible for offline bootstrap. */
export function offlineAccountId(): string | null {
  const accountId = safeGet(OFFLINE_ACCOUNT_KEY);
  return accountId && accountId.trim() ? accountId : null;
}

export function rememberOfflineAccount(accountId: string): void {
  if (accountId.trim()) safeSet(OFFLINE_ACCOUNT_KEY, accountId);
}

function removeMatchingStorage(storage: Storage, predicate: (key: string) => boolean): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    /* Storage may be unavailable in private/embedded contexts. */
  }
}

/**
 * Removes data tied to the signed-out account while retaining benign UI choices
 * such as theme and performance preferences. This deliberately drops unsynced
 * writes: an explicit logout must never replay one person's data as another.
 */
export async function clearOfflineAccountData(): Promise<void> {
  if (!isBrowser) return;

  removeMatchingStorage(
    window.localStorage,
    (key) => key.startsWith(SNAPSHOT_PREFIX) || ACCOUNT_DATA_KEYS.has(key)
  );
  removeMatchingStorage(
    window.sessionStorage,
    (key) => key.startsWith('sb_journal_draft_v1:') || key.startsWith('sb_')
  );

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('studybuddy-'))
          .map((key) => window.caches.delete(key))
      );
    }
  } catch {
    /* Service-worker cache access is optional in embedded webviews. */
  }
}
