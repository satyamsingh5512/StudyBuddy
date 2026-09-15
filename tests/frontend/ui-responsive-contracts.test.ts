import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (root: string, file: string) => readFile(path.join(root, file), 'utf8');

test('shared responsive controls keep mobile overlays and failures usable', async () => {
  const root = process.cwd();
  const [offline, layout, dialog, modal, queryError] = await Promise.all([
    read(root, 'src/components/OfflineIndicator.tsx'),
    read(root, 'src/components/Layout.tsx'),
    read(root, 'src/components/ui/dialog.tsx'),
    read(root, 'src/components/dashboard/glass/GlassModal.tsx'),
    read(root, 'src/components/QueryErrorState.tsx'),
  ]);

  assert.match(offline, /if \(!user \|\| \(isOnline && pending === 0\)\) return null/);
  assert.match(offline, /safe-area-inset-bottom/);
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(layout, /mobileMenuCloseRef\.current\?\.focus\(\)/);
  assert.match(dialog, /min-h-11 min-w-11/);
  assert.match(modal, /event\.key === 'Escape'/);
  assert.match(modal, /previouslyFocused\?\.focus\(\)/);
  assert.match(queryError, /role="alert"/);
  assert.match(queryError, /Try again/);
});

test('important list views distinguish query errors from empty data', async () => {
  const root = process.cwd();
  const [notes, schedule, messages, reports, friends, leaderboard] = await Promise.all([
    read(root, 'src/views/Notes.tsx'),
    read(root, 'src/views/Schedule.tsx'),
    read(root, 'src/views/Messages.tsx'),
    read(root, 'src/views/Reports.tsx'),
    read(root, 'src/views/Friends.tsx'),
    read(root, 'src/views/Leaderboard.tsx'),
  ]);

  for (const source of [notes, schedule, messages, reports, friends, leaderboard]) {
    assert.match(source, /QueryErrorState/);
  }
  assert.match(schedule, /refetchAvailability/);
  assert.match(schedule, /refetchSchedules/);
  assert.match(messages, /messagesError/);
  assert.match(reports, /refetchTrend/);
});
