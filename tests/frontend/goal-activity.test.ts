import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIfCurrentActivityMutation,
  beginActivityMutation,
  goalActivityPath,
  replaceActivityEntity,
} from '../../src/lib/goalQueries.ts';

test('activity write paths encode the browser IANA timezone', () => {
  const paths = [
    '/goals/g/sub-goals/s/completions/2026-08-07',
    '/goals/g/show-ups/2026-08-07',
    '/goals/g/check-ins/2026-08-03',
  ];
  for (const path of paths) {
    assert.equal(goalActivityPath(path, 'Asia/Kolkata'), `${path}?timezone=Asia%2FKolkata`);
  }
  assert.equal(
    goalActivityPath('/goals/g/show-ups/2026-08-07?source=manual', 'America/Argentina/Buenos_Aires'),
    '/goals/g/show-ups/2026-08-07?source=manual&timezone=America%2FArgentina%2FBuenos_Aires',
  );
});

test('entity rollback preserves unrelated activity', () => {
  const current = [
    { id: 'newer', date: '2026-08-07' },
    { id: 'other-date', date: '2026-08-08' },
  ];
  const restored = replaceActivityEntity(
    current,
    (item) => item.date === '2026-08-07',
    [{ id: 'previous', date: '2026-08-07' }],
  );
  assert.deepEqual(restored, [
    { id: 'other-date', date: '2026-08-08' },
    { id: 'previous', date: '2026-08-07' },
  ]);
});

test('an older failed mutation cannot overwrite a newer success', () => {
  const entity = `goal:show-up:${Date.now()}`;
  const older = beginActivityMutation(entity);
  const newer = beginActivityMutation(entity);
  let cached = 'newer-success';

  const olderRollbackApplied = applyIfCurrentActivityMutation(entity, older, () => { cached = 'older-snapshot'; });
  const newerSuccessApplied = applyIfCurrentActivityMutation(entity, newer, () => { cached = 'newer-success'; });

  assert.equal(olderRollbackApplied, false);
  assert.equal(newerSuccessApplied, true);
  assert.equal(cached, 'newer-success');
});
