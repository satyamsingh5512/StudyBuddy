import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { GOAL_KEYS } from '../../src/lib/goalQueries.ts';
import { batchShowUpRequestInit, reconcileBatchShowUps } from '../../src/lib/quickShowUp.ts';
import type { ShowUp } from '../../src/types/goals.ts';

const entry: ShowUp = { id: 's2', goalId: 'g1', date: '2026-08-07', status: 'complete', source: 'manual', createdAt: '', updatedAt: '' };


test('all-active Quick Show-up request omits goalIds instead of sending a capped client list', () => {
  const request = batchShowUpRequestInit({ status: 'complete', timezone: 'Asia/Kolkata' });
  assert.equal(request.method, 'POST');
  assert.deepEqual(JSON.parse(String(request.body)), {
    status: 'complete',
    timezone: 'Asia/Kolkata',
  });
  assert.equal('goalIds' in JSON.parse(String(request.body)), false);
});

test('batch response updates matching show-up ranges and invalidates successful goal activity only', () => {
  const client = new QueryClient();
  const range = { from: '2026-08-01', to: '2026-08-31' };
  const showUpsKey = GOAL_KEYS.showUps('g1', range, 'Asia/Kolkata');
  const statsKey = GOAL_KEYS.stats('g1', range, 'Asia/Kolkata');
  const failedStatsKey = GOAL_KEYS.stats('g2', range, 'Asia/Kolkata');
  client.setQueryData(showUpsKey, [{ ...entry, id: 'old', status: 'partial' }]);
  client.setQueryData(statsKey, { momentum: 10 });
  client.setQueryData(failedStatsKey, { momentum: 20 });

  const ids = reconcileBatchShowUps(client, { results: [
    { goalId: 'g1', ok: true, date: entry.date, entry },
    { goalId: 'g2', ok: false, error: 'not saved' },
  ] });

  assert.deepEqual(ids, ['g1']);
  assert.deepEqual(client.getQueryData(showUpsKey), [entry]);
  assert.equal(client.getQueryState(statsKey)?.isInvalidated, true);
  assert.equal(client.getQueryState(failedStatsKey)?.isInvalidated, false);
});
