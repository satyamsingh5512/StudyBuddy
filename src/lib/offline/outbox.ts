/**
 * Offline outbox: durable write queue with idempotency keys.
 *
 * How conflict-free sync works:
 *  1. Every mutation enqueued here gets a stable `clientMutationId` (uuid).
 *  2. The same id is sent as `X-Client-Mutation-Id` header AND in the JSON
 *     body (`clientMutationId`), so a retried request is deduplicated by the
 *     backend instead of applied twice.
 *  3. FIFO processing stops at the first failure so dependent writes never
 *     overtake it; retry metadata is persisted and entries expire after 7 days.
 *  4. Last-write-wins per entity: for todo updates we coalesce queued ops on
 *     the same todo id into the newest patch before sending.
 */

import { apiFetch } from '@/config/api';
import { readJSON, writeJSON } from './storage';

export type OutboxOpType =
  | 'timer-session'
  | 'todo-create'
  | 'todo-update'
  | 'todo-delete'
  | 'schedule-item-update'
  | 'note-create'
  | 'note-update'
  | 'report-create';

export interface OutboxEntry {
  id: string; // clientMutationId
  type: OutboxOpType;
  path: string;
  method: string;
  body: Record<string, unknown>;
  entityId?: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}

const OUTBOX_KEY = 'sb_outbox_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function newMutationId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function loadOutbox(): OutboxEntry[] {
  const list = readJSON<OutboxEntry[]>(OUTBOX_KEY, []);
  if (!Array.isArray(list)) return [];
  const now = Date.now();
  const valid = list
    .filter((entry): entry is OutboxEntry => !!entry && typeof entry.id === 'string')
    .filter((entry) => {
      const age = now - new Date(entry.createdAt || 0).getTime();
      return Number.isFinite(age) ? age < MAX_AGE_MS : true;
    });
  if (valid.length !== list.length) writeJSON(OUTBOX_KEY, valid);
  return valid.map((entry) => ({
    ...entry,
    body: entry.body && typeof entry.body === 'object' ? entry.body : {},
    attempts: Number.isFinite(entry.attempts) ? entry.attempts : 0,
  }));
}

function persistOutbox(list: OutboxEntry[]): void {
  writeJSON(OUTBOX_KEY, list);
}

function notifyOutboxChanged(list = loadOutbox()): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studybuddy:outbox-changed', { detail: { pending: list.length } }));
  }
}

export function enqueueOutbox(op: Omit<OutboxEntry, 'id' | 'createdAt' | 'attempts'> & { id?: string }): string {
  const id = op.id || newMutationId();
  const entry: OutboxEntry = {
    id,
    type: op.type,
    path: op.path,
    method: op.method,
    body: { ...op.body, clientMutationId: id },
    entityId: op.entityId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const list = loadOutbox();
  list.push(entry);
  persistOutbox(list);
  notifyOutboxChanged(list);
  return id;
}

export function removeOutboxEntries(ids: string[]): void {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  const remaining = loadOutbox().filter((entry) => !drop.has(entry.id));
  persistOutbox(remaining);
  notifyOutboxChanged(remaining);
}

export function pendingOutboxCount(): number {
  try {
    return loadOutbox().length;
  } catch {
    return 0;
  }
}

/**
 * Coalesce todo-update ops for the same entity so replays converge to the
 * newest patch (last-write-wins) instead of replaying stale intermediates.
 * The normalized list is persisted so stale operations do not remain queued.
 */
function coalesce(entries: OutboxEntry[]): OutboxEntry[] {
  const latestUpdateByEntity = new Map<string, OutboxEntry>();
  for (const entry of entries) {
    if (entry.type === 'todo-update' && entry.entityId) {
      latestUpdateByEntity.set(entry.entityId, entry);
    }
  }
  return entries.filter(
    (entry) =>
      entry.type !== 'todo-update' ||
      !entry.entityId ||
      latestUpdateByEntity.get(entry.entityId)?.id === entry.id
  );
}

function normalizedOutbox(): OutboxEntry[] {
  const entries = loadOutbox();
  const normalized = coalesce(entries);
  if (normalized.length !== entries.length) {
    persistOutbox(normalized);
    notifyOutboxChanged(normalized);
  }
  return normalized;
}

function updateOutboxEntry(id: string, update: (entry: OutboxEntry) => OutboxEntry): void {
  const entries = loadOutbox();
  const next = entries.map((entry) => (entry.id === id ? update(entry) : entry));
  persistOutbox(next);
}

function markAttempt(entry: OutboxEntry): void {
  updateOutboxEntry(entry.id, (current) => ({
    ...current,
    attempts: current.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: undefined,
  }));
}

function markFailure(entry: OutboxEntry, message: string): void {
  updateOutboxEntry(entry.id, (current) => ({ ...current, lastError: message }));
}

function replaceExactValue(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map((item) => replaceExactValue(item, from, to));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        replaceExactValue(item, from, to),
      ])
    );
  }
  return value;
}

/** Replace a local optimistic Todo id in all future queued operations. */
function reconcileTemporaryTodoId(temporaryId: string, serverId: string): void {
  if (!temporaryId.startsWith('temp-') || !serverId) return;
  const entries = loadOutbox();
  const next = entries.map((entry) => ({
    ...entry,
    entityId: entry.entityId === temporaryId ? serverId : entry.entityId,
    path: entry.path.split(temporaryId).join(serverId),
    body: replaceExactValue(entry.body, temporaryId, serverId) as Record<string, unknown>,
  }));
  persistOutbox(next);
}

async function createdTodoId(response: Response): Promise<string | null> {
  try {
    const payload = (await response.clone().json()) as { id?: unknown };
    return typeof payload.id === 'string' && payload.id ? payload.id : null;
  } catch {
    return null;
  }
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

let inFlightSync: Promise<SyncResult> | null = null;

async function syncOutboxInternal(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, pending: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    result.pending = pendingOutboxCount();
    return result;
  }

  // Always take the first durable entry after each success. This preserves
  // dependency order (create -> update -> delete) even after temp-ID rewrites.
  for (;;) {
    const entry = normalizedOutbox()[0];
    if (!entry) break;

    markAttempt(entry);
    try {
      const response = await apiFetch(entry.path, {
        method: entry.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Mutation-Id': entry.id,
        },
        body: JSON.stringify({ ...entry.body, clientMutationId: entry.id }),
      });

      const deleteAlreadyApplied = entry.type === 'todo-delete' && response.status === 404;
      if (response.ok || deleteAlreadyApplied) {
        if (entry.type === 'todo-create' && entry.entityId) {
          const serverId = await createdTodoId(response);
          if (serverId) reconcileTemporaryTodoId(entry.entityId, serverId);
        }
        removeOutboxEntries([entry.id]);
        result.synced += 1;
        continue;
      }

      // Never discard conflicts/auth/validation failures. Keeping the first
      // failed write preserves FIFO and makes a repair or re-auth possible.
      const message = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      markFailure(entry, message);
      result.failed += 1;
      break;
    } catch (error) {
      markFailure(entry, error instanceof Error ? error.message : 'Network request failed');
      result.failed += 1;
      break;
    }
  }

  result.pending = pendingOutboxCount();
  if (result.synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studybuddy:outbox-synced', { detail: { synced: result.synced } }));
  }
  return result;
}

/** Push queued writes serially and FIFO. Returns counts; never rejects. */
export function syncOutbox(): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;
  inFlightSync = syncOutboxInternal().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}
