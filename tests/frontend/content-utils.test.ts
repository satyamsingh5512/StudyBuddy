import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JournalSaveSequencer,
  JOURNAL_MAX_MARKDOWN_BYTES,
  achievementProgress,
  addJournalDays,
  appendMentorExchange,
  applyMarkdownTransform,
  buildMentorRequest,
  deriveAchievements,
  extractJournalAttachmentIds,
  isDateKey,
  journalDraftKey,
  journalMarkdownBytes,
  journalMarkdownWithinLimit,
  journalYearRange,
  parseJournalDraft,
  removeJournalAttachment,
  sanitizeMarkdownUrl,
} from '../../src/lib/contentUtils.ts';
import type { MentorMessage } from '../../src/types/content.ts';

test('markdown transforms preserve selection and format inline and line content', () => {
  assert.equal(applyMarkdownTransform('read this', 5, 9, 'bold').value, 'read **this**');
  assert.equal(applyMarkdownTransform('one\ntwo', 0, 7, 'bullets').value, '- one\n- two');
  assert.equal(applyMarkdownTransform('one\ntwo', 0, 7, 'numbering').value, '1. one\n2. two');
  assert.equal(applyMarkdownTransform('', 0, 0, 'highlight').value, '`highlighted text`');
  assert.equal(applyMarkdownTransform('topic', 0, 5, 'link', 'javascript:alert(1)').value, '[topic](https://)');
});

test('markdown URL allowlists reject scripts, data, credentials, and external images', () => {
  assert.equal(sanitizeMarkdownUrl('https://example.com/a', 'link'), 'https://example.com/a');
  assert.equal(sanitizeMarkdownUrl('mailto:study@example.com', 'link'), 'mailto:study@example.com');
  assert.equal(sanitizeMarkdownUrl('#review', 'link'), '#review');
  assert.equal(sanitizeMarkdownUrl('javascript:alert(1)', 'link'), '');
  assert.equal(sanitizeMarkdownUrl('data:text/html,x', 'link'), '');
  assert.equal(sanitizeMarkdownUrl('https://example.com/image.png', 'image'), '');
  assert.equal(
    sanitizeMarkdownUrl('/api/journal/attachments/0123456789abcdef01234567', 'image'),
    '/api/journal/attachments/0123456789abcdef01234567'
  );
});

test('attachment extraction is unique and removal is owner-route specific', () => {
  const id = '0123456789abcdef01234567';
  const markdown = `![first](/api/journal/attachments/${id})\n![again](/api/journal/attachments/${id})`;
  assert.deepEqual(extractJournalAttachmentIds(markdown), [id]);
  assert.equal(removeJournalAttachment(markdown, id).includes(id), false);
});

test('journal dates, ranges, and crash drafts are validated', () => {
  assert.equal(isDateKey('2024-02-29'), true);
  assert.equal(isDateKey('2023-02-29'), false);
  assert.equal(addJournalDays('2024-02-29', 1), '2024-03-01');
  assert.deepEqual(journalYearRange('2026-08-07'), { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(journalDraftKey('2026-08-07'), 'studybuddy:journal-draft:2026-08-07');
  const draft = { date: '2026-08-07', markdown: 'draft', baseRevision: 2, savedAt: new Date().toISOString() };
  assert.deepEqual(parseJournalDraft(JSON.stringify(draft), draft.date), draft);
  assert.equal(parseJournalDraft(JSON.stringify({ ...draft, date: '2026-08-08' }), draft.date), null);
});

test('autosave is single-flight and drains only latest queued content at the next revision', async () => {
  const calls: Array<{
    request: { date: string; markdown: string; expectedRevision: number };
    resolve: (entry: { date: string; markdown: string; revision: number; attachmentIds: string[] }) => void;
  }> = [];
  const sequencer = new JournalSaveSequencer('2026-08-07', 7, (request) =>
    new Promise((resolve) => calls.push({ request, resolve }))
  );

  const first = sequencer.enqueue('first edit');
  const saveNowWhileSaving = sequencer.enqueue('first edit');
  const superseded = sequencer.enqueue('newer edit');
  const latest = sequencer.enqueue('latest edit');

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].request, {
    date: '2026-08-07',
    markdown: 'first edit',
    expectedRevision: 7,
  });

  calls[0].resolve({
    date: '2026-08-07',
    markdown: 'first edit',
    revision: 8,
    attachmentIds: [],
  });
  assert.equal((await first).entry.revision, 8);
  assert.equal((await saveNowWhileSaving).entry.revision, 8);
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].request, {
    date: '2026-08-07',
    markdown: 'latest edit',
    expectedRevision: 8,
  });
  calls[1].resolve({
    date: '2026-08-07',
    markdown: 'latest edit',
    revision: 9,
    attachmentIds: [],
  });

  assert.equal((await superseded).markdown, 'latest edit');
  assert.equal((await latest).entry.revision, 9);
  assert.equal(sequencer.revision, 9);
  assert.equal(sequencer.isSaving, false);
});

test('journal limit counts UTF-8 bytes including multibyte characters', () => {
  assert.equal(journalMarkdownBytes('a😀'), 5);
  assert.equal(journalMarkdownWithinLimit('a'.repeat(JOURNAL_MAX_MARKDOWN_BYTES)), true);
  assert.equal(
    journalMarkdownWithinLimit('😀'.repeat(JOURNAL_MAX_MARKDOWN_BYTES / 4)),
    true
  );
  assert.equal(
    journalMarkdownWithinLimit(`😀${'a'.repeat(JOURNAL_MAX_MARKDOWN_BYTES - 3)}`),
    false
  );
});

test('mentor request history is bounded, trimmed, and thread remains ephemeral-sized', () => {
  const messages: MentorMessage[] = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    role: index % 2 ? 'assistant' : 'user',
    content: ` message ${index} `,
  }));
  const request = buildMentorRequest(messages, ' next question ', true);
  assert.equal(request.history.length, 12);
  assert.equal(request.history[0].content, 'message 8');
  assert.equal(request.message, 'next question');
  assert.equal(request.maxOutputTokens, 600);
  assert.equal(request.includeJournal, true);
  assert.equal(appendMentorExchange(messages, messages.slice(0, 10)).length, 25);
});

test('achievement derivation reports locked/unlocked progress and clamps percentages', () => {
  const achievements = deriveAchievements(7, 3);
  assert.equal(achievements.find((item) => item.id === 'streak-7')?.earned, true);
  assert.equal(achievements.find((item) => item.id === 'streak-14')?.progress, 7);
  assert.equal(achievements.find((item) => item.id === 'goals-3')?.earned, true);
  assert.equal(achievements.find((item) => item.id === 'goals-5')?.earned, false);
  assert.equal(achievementProgress(7, 14), 50);
  assert.equal(achievementProgress(99, 10), 100);
  assert.equal(achievementProgress(2, 0), 0);
});
