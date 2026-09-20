import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

test('room views stay mobile-safe: no fixed widths, long text always wraps', async () => {
  const [discovery, detail, dialog] = await Promise.all([
    read('src/views/StudyRooms.tsx'),
    read('src/views/StudyRoom.tsx'),
    read('src/components/rooms/CreateRoomDialog.tsx'),
  ]);

  for (const [name, source] of [
    ['StudyRooms', discovery],
    ['StudyRoom', detail],
    ['CreateRoomDialog', dialog],
  ] as const) {
    // A fixed pixel width is the usual cause of horizontal scroll on a 320px
    // screen; grids must be responsive instead.
    assert.doesNotMatch(source, /className="[^"]*\bw-\[\d+px\]/, `${name} pins a pixel width`);
    // Room names and messages are user input of arbitrary length.
    assert.match(source, /min-w-0/, `${name} lacks min-w-0 flex/grid guards`);
  }

  // Grids start at one column and only widen at breakpoints.
  assert.match(discovery, /grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(detail, /grid-cols-1 gap-2 sm:grid-cols-2/);
  // User-authored strings must wrap or truncate rather than overflow.
  assert.match(discovery, /truncate text-base font-semibold/);
  assert.match(detail, /whitespace-pre-wrap break-words/);
  assert.match(detail, /break-words text-xl font-bold/);
  // The tab strip scrolls inside its own container, not the page.
  assert.match(detail, /role="tablist"[\s\S]{0,200}overflow-x-auto/);
  // The chat log is height-capped so it cannot grow the page unbounded.
  assert.match(detail, /max-h-\[55vh\][^"]*overflow-y-auto/);
});

test('room UI is keyboard and screen-reader operable', async () => {
  const [discovery, detail] = await Promise.all([
    read('src/views/StudyRooms.tsx'),
    read('src/views/StudyRoom.tsx'),
  ]);

  // Tabs implement the ARIA tab pattern, not clickable divs.
  assert.match(detail, /role="tab"/);
  assert.match(detail, /aria-selected=\{selected\}/);
  assert.match(detail, /aria-controls=\{`room-panel-/);
  assert.match(detail, /role="tabpanel"/);

  // Icon-only controls carry names; decorative icons are hidden.
  assert.match(detail, /aria-label="Send message"/);
  assert.match(detail, /aria-label="Delete this message"/);
  assert.match(detail, /aria-label={`React with \$\{emoji\}`}/);
  assert.match(detail, /aria-hidden="true"/);

  // The chat log and the live session announce updates.
  assert.match(detail, /role="log"/);
  assert.match(detail, /aria-live="polite"/);

  // Every filter control has a label, even when visually hidden.
  assert.match(discovery, /htmlFor="room-search"[\s\S]{0,120}sr-only/);
  assert.match(discovery, /htmlFor="room-category"/);
  assert.match(discovery, /htmlFor="room-sort"/);

  // Focus rings must never be removed without a replacement.
  for (const source of [discovery, detail]) {
    if (/focus-visible:outline-none/.test(source)) {
      assert.match(source, /focus-visible:ring-2/);
    }
  }

  // Tap targets on the touch surfaces clear ~44px.
  assert.match(detail, /min-h-11/);
  assert.match(discovery, /h-11/);
});

test('room views separate query failure from empty data', async () => {
  const [discovery, detail] = await Promise.all([
    read('src/views/StudyRooms.tsx'),
    read('src/views/StudyRoom.tsx'),
  ]);
  for (const source of [discovery, detail]) {
    assert.match(source, /QueryErrorState/);
    assert.match(source, /isError/);
  }
  // An error must not be rendered as "no rooms found".
  assert.match(discovery, /discovery\.isError \?[\s\S]{0,400}No rooms match those filters/);
});

test('rooms data layer never opens a websocket and degrades without Redis', async () => {
  const source = await read('src/lib/roomQueries.ts');
  // The backend has no websocket server; introducing one here would break the
  // documented free-tier realtime design.
  assert.doesNotMatch(source, /new WebSocket|io\(|socket\.io/);
  // Long-poll plus an interval fallback when the stream reports disabled.
  assert.match(source, /rooms\/\$\{roomId\}\/changes/);
  assert.match(source, /if \(!changes\.enabled\)/);
  assert.match(source, /refetchInterval: ROOM_POLL_FALLBACK_MS/);
  // Heartbeat must be more frequent than the 90s server TTL.
  assert.match(source, /PRESENCE_HEARTBEAT_MS = 30_000/);
  // Polling must stop when the room rejects the caller, or a removed member
  // would hammer the endpoint forever.
  assert.match(source, /status === 401 \|\| response\.status === 403 \|\| response\.status === 404/);
});

test('room navigation is registered and reachable', async () => {
  const [navigation, page, detailPage] = await Promise.all([
    read('src/config/navigation.ts'),
    read('app/rooms/page.tsx'),
    read('app/rooms/[roomId]/page.tsx'),
  ]);
  assert.match(navigation, /path: '\/rooms', label: 'Study Rooms'/);
  // Both routes must stay behind AuthGuard: room data is member-only.
  assert.match(page, /AuthGuard/);
  assert.match(detailPage, /AuthGuard/);
  assert.match(detailPage, /useParams/);
});
