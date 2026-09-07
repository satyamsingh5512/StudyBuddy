import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

class TestCustomEvent<T = unknown> extends Event {
  detail: T | undefined;
  constructor(type: string, init?: { detail?: T }) {
    super(type);
    this.detail = init?.detail;
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const eventTarget = new EventTarget();
const navigatorState = { onLine: true };

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: Object.assign(eventTarget, { localStorage, sessionStorage }),
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: navigatorState,
});
Object.defineProperty(globalThis, 'CustomEvent', {
  configurable: true,
  value: TestCustomEvent,
});

const outbox = await import('../../src/lib/offline/outbox.ts');
const storage = await import('../../src/lib/offline/storage.ts');
const api = await import('../../src/config/api.ts');

const originalFetch = globalThis.fetch;

test.after(() => {
  globalThis.fetch = originalFetch;
});

test.beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  navigatorState.onLine = true;
});

test('outbox sends the stable mutation ID in header and body before removing a successful entry', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  };

  outbox.enqueueOutbox({
    id: 'mutation-stable',
    type: 'todo-update',
    path: '/todos/a',
    method: 'PATCH',
    body: { completed: true },
    entityId: 'a',
  });
  const result = await outbox.syncOutbox();

  assert.deepEqual(result, { synced: 1, failed: 0, pending: 0 });
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].init?.headers).get('X-Client-Mutation-Id'), 'mutation-stable');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    completed: true,
    clientMutationId: 'mutation-stable',
  });
});

test('a 5xx keeps the FIFO head, persists attempts, and blocks later dependent writes', async () => {
  const paths: string[] = [];
  globalThis.fetch = async (path) => {
    paths.push(String(path));
    return new Response('unavailable', { status: 503, statusText: 'Unavailable' });
  };

  outbox.enqueueOutbox({ id: 'first', type: 'todo-update', path: '/todos/first', method: 'PATCH', body: {}, entityId: 'first' });
  outbox.enqueueOutbox({ id: 'second', type: 'todo-update', path: '/todos/second', method: 'PATCH', body: {}, entityId: 'second' });
  const result = await outbox.syncOutbox();

  assert.deepEqual(result, { synced: 0, failed: 1, pending: 2 });
  assert.deepEqual(paths, ['/api/todos/first']);
  const [first, second] = outbox.loadOutbox();
  assert.equal(first.id, 'first');
  assert.equal(first.attempts, 1);
  assert.match(first.lastError || '', /HTTP 503/);
  assert.equal(second.attempts, 0);
});

test('a created Todo rewrites later temporary-ID update paths and bodies before FIFO replay', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (path, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ path: String(path), body });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ id: 'server-todo' }), { status: 201 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  outbox.enqueueOutbox({
    id: 'create', type: 'todo-create', path: '/todos', method: 'POST',
    body: { title: 'Offline task' }, entityId: 'temp-todo',
  });
  outbox.enqueueOutbox({
    id: 'patch', type: 'todo-update', path: '/todos/temp-todo', method: 'PATCH',
    body: { todoId: 'temp-todo', completed: true }, entityId: 'temp-todo',
  });

  const result = await outbox.syncOutbox();
  assert.deepEqual(result, { synced: 2, failed: 0, pending: 0 });
  assert.equal(calls[1].path, '/api/todos/server-todo');
  assert.equal(calls[1].body.todoId, 'server-todo');
  assert.equal(calls[1].body.clientMutationId, 'patch');
});

test('an already-applied Todo delete is idempotent, while a 409 remains queued for repair', async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  outbox.enqueueOutbox({ id: 'delete', type: 'todo-delete', path: '/todos/a', method: 'DELETE', body: {}, entityId: 'a' });
  assert.deepEqual(await outbox.syncOutbox(), { synced: 1, failed: 0, pending: 0 });

  globalThis.fetch = async () => new Response('conflict', { status: 409, statusText: 'Conflict' });
  outbox.enqueueOutbox({ id: 'conflict', type: 'todo-update', path: '/todos/a', method: 'PATCH', body: { completed: false }, entityId: 'a' });
  assert.deepEqual(await outbox.syncOutbox(), { synced: 0, failed: 1, pending: 1 });
  assert.equal(outbox.loadOutbox()[0].id, 'conflict');
  assert.match(outbox.loadOutbox()[0].lastError || '', /HTTP 409/);
});

test('GET snapshots recover only from transport failures, never an HTTP rejection', async () => {
  storage.saveSnapshot('api:get:/private', { cached: true });
  navigatorState.onLine = false;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.deepEqual(await api.apiFetchJSON('/private'), { cached: true });

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(() => api.apiFetchJSON('/private'), /Unauthorized/);
});
