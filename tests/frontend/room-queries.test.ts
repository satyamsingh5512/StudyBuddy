import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_QUERY_KEYS,
  ROOM_REACTIONS,
  VISIBILITY_LABELS,
  categoryLabel,
  deskAccessibleLabel,
  flattenMessagePages,
  flattenRoomPages,
  formatCountdown,
  formatFocusMinutes,
  presenceDotClass,
  presenceLabel,
  secondsUntil,
  type RoomDesk,
  type RoomMessage,
  type StudyRoom,
} from '../../src/lib/roomQueries.ts';

const desk = (overrides: Partial<RoomDesk>): RoomDesk => ({
  user: { id: 'u1', name: 'Aditi', username: 'aditi' },
  state: 'studying',
  focusMinutes: 42,
  updatedAt: '2026-09-19T10:00:00Z',
  ...overrides,
});

const message = (id: string, body = 'hi'): RoomMessage => ({
  id,
  body,
  deleted: false,
  pinned: false,
  mentions: [],
  reactions: [],
  createdAt: '2026-09-19T10:00:00Z',
  userId: 'u1',
});

test('formatFocusMinutes renders hours and minutes without lying about zero', () => {
  assert.equal(formatFocusMinutes(0), '0m');
  assert.equal(formatFocusMinutes(45), '45m');
  assert.equal(formatFocusMinutes(60), '1h');
  assert.equal(formatFocusMinutes(85), '1h 25m');
  assert.equal(formatFocusMinutes(1440), '24h');
  // Defensive: the API is trusted but a malformed number must not render NaN.
  assert.equal(formatFocusMinutes(-5), '0m');
  assert.equal(formatFocusMinutes(Number.NaN), '0m');
  assert.equal(formatFocusMinutes(Number.POSITIVE_INFINITY), '0m');
});

test('presence state is never communicated by colour alone', () => {
  // Every state must have a readable label, because the dot colour is
  // decorative and unusable for screen readers or colour-blind users.
  for (const state of ['online', 'studying', 'deep_focus', 'break', 'away']) {
    assert.ok(presenceLabel(state).length > 0, `no label for ${state}`);
    assert.match(presenceDotClass(state), /^bg-/);
  }
  assert.equal(presenceLabel('deep_focus'), 'Deep focus');
  // An unknown state from a newer server must degrade, not crash.
  assert.equal(presenceLabel('teleporting'), 'Online');
  assert.match(presenceDotClass('teleporting'), /^bg-/);
});

test('desk labels describe who, what state, and how long for assistive tech', () => {
  assert.equal(deskAccessibleLabel(desk({})), 'Aditi, studying, 42m');
  assert.equal(
    deskAccessibleLabel(desk({ state: 'deep_focus', focusMinutes: 95 })),
    'Aditi, deep focus, 1h 35m'
  );
  // Non-focus states must not claim a focus duration.
  assert.equal(deskAccessibleLabel(desk({ state: 'break', focusMinutes: 42 })), 'Aditi, on a break');
  assert.equal(
    deskAccessibleLabel(desk({ user: { id: 'u2', name: '', username: 'rahul' } })),
    'rahul, studying, 42m'
  );
});

test('countdowns stay monotonic and never go negative', () => {
  const now = Date.parse('2026-09-19T10:00:00Z');
  assert.equal(secondsUntil('2026-09-19T10:00:30Z', now), 30);
  assert.equal(secondsUntil('2026-09-19T10:25:00Z', now), 1500);
  // A session that already ended must read zero, not a negative timer.
  assert.equal(secondsUntil('2026-09-19T09:59:00Z', now), 0);
  assert.equal(secondsUntil('not-a-date', now), 0);

  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(59), '00:59');
  assert.equal(formatCountdown(90), '01:30');
  assert.equal(formatCountdown(1500), '25:00');
  assert.equal(formatCountdown(5400), '1:30:00');
  assert.equal(formatCountdown(-10), '00:00');
  assert.equal(formatCountdown(Number.NaN), '00:00');
});

test('message pages flatten oldest-first and de-duplicate across cursors', () => {
  const firstPage = { messages: [message('c'), message('d')] };
  const olderPage = { messages: [message('a'), message('b')] };
  const flattened = flattenMessagePages([firstPage, olderPage]);
  assert.deepEqual(
    flattened.map((entry) => entry.id),
    ['a', 'b', 'c', 'd']
  );

  // A message that appears in two pages (new message shifting the cursor
  // window) must render once, not twice.
  const overlapping = flattenMessagePages([
    { messages: [message('c'), message('d')] },
    { messages: [message('b'), message('c')] },
  ]);
  assert.deepEqual(
    overlapping.map((entry) => entry.id),
    ['b', 'c', 'd']
  );

  assert.deepEqual(flattenMessagePages(undefined), []);
  assert.deepEqual(flattenMessagePages([]), []);
});

test('room pages flatten in order and de-duplicate', () => {
  const room = (id: string): StudyRoom =>
    ({ id, name: `Room ${id}` }) as StudyRoom;
  const rooms = flattenRoomPages([
    { rooms: [room('1'), room('2')], nextCursor: '2' },
    { rooms: [room('2'), room('3')], nextCursor: '' },
  ]);
  assert.deepEqual(
    rooms.map((entry) => entry.id),
    ['1', '2', '3']
  );
  assert.deepEqual(flattenRoomPages(undefined), []);
});

test('query keys are stable and scoped so invalidation cannot leak across rooms', () => {
  assert.deepEqual(ROOM_QUERY_KEYS.messages('room-a'), ['rooms', 'room-a', 'messages']);
  assert.deepEqual(ROOM_QUERY_KEYS.presence('room-a'), ['rooms', 'room-a', 'presence']);
  assert.deepEqual(ROOM_QUERY_KEYS.leaderboard('room-a', 'weekly'), [
    'rooms',
    'room-a',
    'leaderboard',
    'weekly',
  ]);
  // Two rooms must never share a cache key.
  assert.notDeepEqual(ROOM_QUERY_KEYS.messages('room-a'), ROOM_QUERY_KEYS.messages('room-b'));
  // Every key starts with the 'rooms' prefix so a single invalidate clears all.
  for (const key of [
    ROOM_QUERY_KEYS.mine(),
    ROOM_QUERY_KEYS.detail('x'),
    ROOM_QUERY_KEYS.members('x'),
    ROOM_QUERY_KEYS.rankings(),
    ROOM_QUERY_KEYS.achievements(),
    ROOM_QUERY_KEYS.discovery({}),
  ]) {
    assert.equal(key[0], 'rooms');
  }
});

test('labels cover every visibility and category the API can return', () => {
  for (const visibility of ['public', 'private', 'goal', 'elite'] as const) {
    assert.ok(VISIBILITY_LABELS[visibility].length > 0);
  }
  assert.equal(categoryLabel('competitive-exam'), 'Competitive exam');
  // An unknown category must fall back rather than render "undefined".
  assert.equal(categoryLabel('quantum-basket-weaving'), 'General');
});

test('reaction palette matches the server allowlist exactly', () => {
  // The backend rejects anything outside models.ReactionEmojis, so a mismatch
  // here would ship buttons that always 400.
  assert.deepEqual(ROOM_REACTIONS, ['👍', '🔥', '🎯', '💪', '🧠', '👏', '😅', '❤️']);
});
