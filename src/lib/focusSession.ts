/**
 * Cross-device focus session client.
 *
 * Source of truth is the backend (`focus_sessions` collection):
 *  - the device that starts a timer announces focus-start + heartbeats,
 *  - every other device polls focus-active and shows the guard overlay.
 *
 * Local exemption rule (your logic): while THIS device has its own timer
 * running (floating clock / fullscreen timer → timerSessionStart != null or
 * studying == true), the guard never fires — using the same app is allowed.
 */

import { apiFetch } from '@/config/api';
import { getDeviceId } from '@/lib/capacitor';

export interface RemoteFocusState {
  active: boolean;
  deviceId?: string;
  subject?: string;
  durationMinutes?: number;
  startedAt?: string;
  heartbeatAt?: string;
  isMine?: boolean;
}

type PendingFocusIntent =
  | { action: 'start'; subject?: string; durationMinutes?: number }
  | { action: 'end'; reason: string };

const LOCAL_KEY = 'sb_focus_local_v1';
const PENDING_KEY = 'sb_focus_pending_v1';
let focusOperation: Promise<unknown> = Promise.resolve();

// Focus start/end requests mutate one server-side lease. Serializing them in
// this renderer prevents a slow start from arriving after a fast end and
// resurrecting a session the user already stopped.
function enqueueFocusOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = focusOperation.then(operation, operation);
  focusOperation = next.catch(() => undefined);
  return next;
}

export function myDeviceId(): string {
  return getDeviceId();
}

function readPendingFocus(): PendingFocusIntent | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as PendingFocusIntent;
    return intent?.action === 'start' || intent?.action === 'end' ? intent : null;
  } catch {
    return null;
  }
}

function writePendingFocus(intent: PendingFocusIntent | null): void {
  try {
    if (!intent) window.localStorage.removeItem(PENDING_KEY);
    else window.localStorage.setItem(PENDING_KEY, JSON.stringify(intent));
  } catch {
    /* local focus remains usable if storage is unavailable */
  }
}

/** Clear browser-local focus state when the authenticated account is removed. */
export function clearLocalFocusState(): void {
  writePendingFocus(null);
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

function writeLocalFocus(subject?: string): void {
  try {
    window.localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ deviceId: myDeviceId(), startedAt: new Date().toISOString(), subject })
    );
  } catch {
    /* ignore */
  }
}

async function requestFocus(path: string, body: Record<string, unknown>): Promise<Response> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Focus request failed (${response.status})`);
  return response;
}

/** Replay the last intended state once the device is online again. */
async function syncPendingFocusIntentInternal(): Promise<boolean> {
  const intent = readPendingFocus();
  if (!intent) return true;
  try {
    if (intent.action === 'start') {
      await requestFocus('/timer/focus-start', {
        deviceId: myDeviceId(),
        subject: intent.subject,
        durationMinutes: intent.durationMinutes,
      });
    } else {
      await requestFocus('/timer/focus-end', {
        deviceId: myDeviceId(),
        endReason: intent.reason,
      });
    }
    writePendingFocus(null);
    return true;
  } catch {
    return false;
  }
}

export function syncPendingFocusIntent(): Promise<boolean> {
  return enqueueFocusOperation(syncPendingFocusIntentInternal);
}

export function announceFocusStart(subject?: string, durationMinutes?: number): Promise<void> {
  return enqueueFocusOperation(async () => {
    // Mark this device immediately so a reload remains exempt even offline.
    writeLocalFocus(subject);
    try {
      await requestFocus('/timer/focus-start', { deviceId: myDeviceId(), subject, durationMinutes });
      writePendingFocus(null);
    } catch {
      writePendingFocus({ action: 'start', subject, durationMinutes });
    }
  });
}

export function sendFocusHeartbeat(): Promise<boolean> {
  return enqueueFocusOperation(async () => {
    if (!(await syncPendingFocusIntentInternal())) return false;
    try {
      await requestFocus('/timer/focus-heartbeat', { deviceId: myDeviceId() });
      return true;
    } catch {
      return false;
    }
  });
}

export function announceFocusEnd(reason = 'ended'): Promise<void> {
  return enqueueFocusOperation(async () => {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* ignore */
    }
    try {
      await requestFocus('/timer/focus-end', { deviceId: myDeviceId(), endReason: reason });
      writePendingFocus(null);
    } catch {
      // An end supersedes an unsent start. Replaying it is harmless if the
      // server never saw the start, and prevents a stale remote guard otherwise.
      writePendingFocus({ action: 'end', reason });
    }
  });
}

/** Remote interrupt: this phone was used too long during another device's focus. */
export function interruptRemoteFocus(): Promise<void> {
  return enqueueFocusOperation(async () => {
    try {
      await requestFocus('/timer/focus-end', { endReason: 'phone-interrupt' });
    } catch {
      /* the guard stays local; a later poll will reconcile the remote state */
    }
  });
}

export async function fetchRemoteFocus(): Promise<RemoteFocusState> {
  try {
    const res = await apiFetch('/timer/focus-active');
    if (!res.ok) return { active: false };
    const data = (await res.json()) as RemoteFocusState;
    if (!data || !data.active) return { active: false };
    return { ...data, isMine: data.deviceId === myDeviceId() };
  } catch {
    return { active: false };
  }
}
