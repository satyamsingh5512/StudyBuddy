import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foregroundReminderDedupeKey,
  reminderDedupeKey,
  shouldTriggerShowUpReminder,
  zonedReminderTime,
} from '../../src/lib/showUpReminder.ts';

const settings = { enabled: true, time: '20:00', days: [] as number[] };
const userId = 'user-a';

test('reminder evaluates date and time in the profile timezone', () => {
  const now = new Date('2026-08-07T14:31:00.000Z');
  const local = zonedReminderTime(now, 'Asia/Kolkata');
  assert.deepEqual(local, { dateKey: '2026-08-07', weekday: 5, minutes: 20 * 60 + 1 });
  const result = shouldTriggerShowUpReminder(now, 'Asia/Kolkata', userId, settings);
  assert.equal(result.trigger, true);
  assert.equal(result.dedupeKey, reminderDedupeKey(userId, '2026-08-07'));
});

test('reminder respects selected weekdays and does not fire before local time', () => {
  const friday = new Date('2026-08-07T14:00:00.000Z'); // 19:30 in Kolkata
  assert.equal(shouldTriggerShowUpReminder(friday, 'Asia/Kolkata', userId, settings).trigger, false);
  assert.equal(shouldTriggerShowUpReminder(new Date('2026-08-07T15:00:00Z'), 'Asia/Kolkata', userId, { ...settings, days: [1] }).trigger, false);
  assert.equal(shouldTriggerShowUpReminder(new Date('2026-08-07T15:00:00Z'), 'Asia/Kolkata', userId, { ...settings, days: [5] }).trigger, true);
});

test('dedupe keys include versioned namespace, authenticated user, and date', () => {
  const first = reminderDedupeKey('user-a', '2026-08-07');
  const second = reminderDedupeKey('user-b', '2026-08-07');
  assert.match(first, /^studybuddy:foreground-reminder:v1:user-a:show-up:2026-08-07$/);
  assert.notEqual(first, second);
  assert.notEqual(
    foregroundReminderDedupeKey('schedule', 'user-a', '2026-08-07', 'item:start'),
    foregroundReminderDedupeKey('schedule', 'user-b', '2026-08-07', 'item:start')
  );
});

test('one user firing on a shared browser does not suppress another user', () => {
  const now = new Date('2026-08-07T15:00:00Z');
  const firstUserKey = reminderDedupeKey('user-a', '2026-08-07');
  const fired = new Set([firstUserKey]);
  assert.equal(shouldTriggerShowUpReminder(now, 'Asia/Kolkata', 'user-a', settings, fired).trigger, false);
  assert.equal(shouldTriggerShowUpReminder(now, 'Asia/Kolkata', 'user-b', settings, fired).trigger, true);
});
