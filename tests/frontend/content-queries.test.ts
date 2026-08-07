import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContentNetworkError,
  ContentServerError,
  ContentValidationError,
  JournalAttachmentConflictError,
  JournalConflictError,
  deleteJournalAttachment,
  fetchJournalEntry,
  requestMentorResponse,
  saveJournalEntry,
} from '../../src/lib/contentQueries.ts';
import { JOURNAL_MAX_MARKDOWN_BYTES } from '../../src/lib/contentUtils.ts';

const date = '2026-08-07';

const withFetch = async (mock: typeof fetch, run: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
};

test('journal rejects oversized multibyte UTF-8 content before network', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      throw new Error('fetch must not run');
    },
    async () => {
      const oversized = `😀${'a'.repeat(JOURNAL_MAX_MARKDOWN_BYTES - 3)}`;
      await assert.rejects(
        saveJournalEntry(date, oversized, 0),
        (error: unknown) =>
          error instanceof ContentValidationError &&
          error.kind === 'validation' &&
          error.message.includes('65,537')
      );
      assert.equal(calls, 0);
    }
  );
});

test('content queries distinguish transport, validation, and server failures', async () => {
  await withFetch(
    async () => {
      throw new TypeError('connection refused');
    },
    async () => {
      await assert.rejects(
        fetchJournalEntry(date),
        (error: unknown) => error instanceof ContentNetworkError && error.kind === 'network'
      );
    }
  );

  await withFetch(
    async () => new Response(JSON.stringify({ error: 'markdown is invalid' }), { status: 400 }),
    async () => {
      await assert.rejects(
        saveJournalEntry(date, 'draft', 0),
        (error: unknown) =>
          error instanceof ContentValidationError && error.status === 400 && error.kind === 'validation'
      );
    }
  );

  await withFetch(
    async () => new Response(JSON.stringify({ error: 'database unavailable' }), { status: 503 }),
    async () => {
      await assert.rejects(
        fetchJournalEntry(date),
        (error: unknown) =>
          error instanceof ContentServerError && error.status === 503 && error.kind === 'server'
      );
    }
  );
});

test('journal 409 errors distinguish authoritative revision and attachment conflicts', async () => {
  const current = { date, markdown: 'server', revision: 4, attachmentIds: [] };
  await withFetch(
    async () =>
      new Response(JSON.stringify({ error: 'changed', current }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    async () => {
      await assert.rejects(
        saveJournalEntry(date, 'local', 3),
        (error: unknown) =>
          error instanceof JournalConflictError &&
          error.kind === 'revision-conflict' &&
          error.current.markdown === 'server'
      );
    }
  );

  await withFetch(
    async () =>
      new Response(JSON.stringify({ error: 'journal references an unavailable attachment' }), {
        status: 409,
      }),
    async () => {
      await assert.rejects(
        saveJournalEntry(date, 'local', 3),
        (error: unknown) =>
          error instanceof JournalAttachmentConflictError &&
          error.kind === 'attachment-conflict' &&
          error.reason === 'unavailable'
      );
    }
  );
});

test('attachment delete conflicts distinguish referenced from deleting', async () => {
  await withFetch(
    async () =>
      new Response(JSON.stringify({ error: 'Attachment is referenced by a journal entry' }), {
        status: 409,
      }),
    async () => {
      await assert.rejects(
        deleteJournalAttachment('0123456789abcdef01234567'),
        (error: unknown) =>
          error instanceof JournalAttachmentConflictError && error.reason === 'referenced'
      );
    }
  );

  await withFetch(
    async () =>
      new Response(
        JSON.stringify({ error: 'Attachment is currently being referenced; retry deletion' }),
        { status: 409 }
      ),
    async () => {
      await assert.rejects(
        deleteJournalAttachment('0123456789abcdef01234567'),
        (error: unknown) =>
          error instanceof JournalAttachmentConflictError && error.reason === 'deleting'
      );
    }
  );
});

test('mentor POST carries explicit request-local journal consent without profile mutation', async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  await withFetch(
    async (input, init) => {
      calls.push({ input, init });
      return new Response(
        JSON.stringify({
          response: 'Focus on revision.',
          metadata: {
            contextBytes: 2,
            journalIncluded: false,
            counts: { goals: 0, showUps: 0, journal: 0, tasks: 0, sessions: 0, reports: 0 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
    async () => {
      await requestMentorResponse({
        message: 'What next?',
        history: [],
        maxOutputTokens: 600,
        includeJournal: false,
      });
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(String(calls[0].input), '/api/mentor/respond');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    message: 'What next?',
    history: [],
    maxOutputTokens: 600,
    includeJournal: false,
  });
});
