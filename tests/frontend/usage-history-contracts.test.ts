import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

test('usage history is event-based, clipped to local days, and never zero-fills missing days', async () => {
  const history = await read('resources/android/digitaldiscipline/UsageHistory.kt');
  assert.match(history, /usage\.queryEvents\(dayStartMs - LEAD_IN_MS, dayEndMs\)/);
  assert.match(history, /val start = maxOf\(from, windowStartMs\)/);
  assert.match(history, /val end = minOf\(to, windowEndMs\)/);
  assert.match(history, /SCREEN_NON_INTERACTIVE, DEVICE_SHUTDOWN -> closeAll\(at\)/);
  assert.match(history, /unlockCount = if \(unlocksSupported\) unlocks else null/);
  assert.match(history, /fun isLikelyTruncated/);
});

test('backfill skips finalised days, stops at the retention edge, and makes no network call', async () => {
  const engines = await read('resources/android/digitaldiscipline/Engines.kt');
  assert.match(engines, /fun backfillHistory\(userId: String, days: Int\): UsageBackfillResult/);
  assert.match(engines, /existing\.updatedAtMs >= dayEnd\.timeInMillis/);
  assert.match(engines, /if \(emptyRun >= MAX_EMPTY_RUN\) break/);
  assert.match(engines, /add\(Calendar\.DAY_OF_YEAR, -offset\)/);
  assert.match(engines, /dao\.focusBetween\(userId, start, end\)/);
  assert.match(engines, /engine\.backfillHistory\(userId, 7\)/);
  assert.doesNotMatch(engines, /HttpURLConnection|OkHttp|Retrofit|java\.net\.URL/);
});

test('schema bump ships a non-destructive migration for the nullable unlock count', async () => {
  const db = await read('resources/android/digitaldiscipline/DigitalDisciplineDatabase.kt');
  assert.match(db, /version = 2/);
  assert.match(db, /ALTER TABLE daily_usage_summaries ADD COLUMN unlockCount INTEGER"/);
  assert.match(db, /\.addMigrations\(MIGRATION_1_2\)/);
  assert.match(db, /val unlockCount: Int\? = null/);
  assert.doesNotMatch(db, /fallbackToDestructiveMigration/);
});

test('web bridge exposes history and per-app breakdown with a validated date', async () => {
  const [bridge, plugin] = await Promise.all([
    read('src/lib/digitalDiscipline.ts'),
    read('resources/android/digitaldiscipline/DigitalDisciplinePlugin.kt'),
  ]);
  assert.match(bridge, /export async function getNativeUsageHistory\(userId: string, days = 30\)/);
  assert.match(bridge, /export async function getNativeAppUsageForDay\(userId: string, localDate: string\)/);
  assert.match(bridge, /unlockCount: number\(data\.unlockCount\)/);
  assert.match(plugin, /fun getDailyUsageHistory\(call: PluginCall\)/);
  assert.match(plugin, /fun getAppUsageForDay\(call: PluginCall\)/);
  assert.match(plugin, /summary\.unlockCount\?\.let \{ put\("unlockCount", it\) \}/);
});
