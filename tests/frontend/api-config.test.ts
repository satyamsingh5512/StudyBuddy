import assert from 'node:assert/strict';
import test from 'node:test';

import { API_URL, apiFetchJSON, apiFetchList, apiUrl } from '../../src/config/api.ts';

test('builds browser API requests on the same-origin /api path', () => {
  assert.equal(API_URL, '/api');
  assert.equal(apiUrl('/auth/me'), '/api/auth/me');
});

test('treats 202 goal cleanup-pending responses as successful JSON', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: 'cleanup_pending', cleanupPending: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  try {
    const result = await apiFetchJSON<{ status: string; cleanupPending: boolean }>(
      '/goals/goal-id',
      {
        method: 'DELETE',
      }
    );
    assert.deepEqual(result, { status: 'cleanup_pending', cleanupPending: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('list fetches always resolve to an array so list views cannot crash on render', async () => {
  const originalFetch = globalThis.fetch;
  const respondWith = (body: string) =>
    new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    // A well-formed collection is passed through untouched.
    globalThis.fetch = async () => respondWith(JSON.stringify([{ id: 'a' }, { id: 'b' }]));
    assert.deepEqual(await apiFetchList<{ id: string }>('/reports'), [
      { id: 'a' },
      { id: 'b' },
    ]);

    // Malformed payloads degrade to an empty collection instead of throwing
    // inside `.map` during render. This is the failure mode that previously
    // blanked pages behind the error boundary.
    for (const malformed of ['{}', 'null', '"text"', '42', '{"items":[]}']) {
      globalThis.fetch = async () => respondWith(malformed);
      assert.deepEqual(await apiFetchList('/reports'), [], `payload ${malformed} should coerce`);
    }

    // 204 responses carry no body and must also be safe.
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.deepEqual(await apiFetchList('/reports'), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('list fetches still surface transport and HTTP failures to the caller', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    await assert.rejects(() => apiFetchList('/reports'), /Unauthorized/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
