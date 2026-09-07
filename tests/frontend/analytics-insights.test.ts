import assert from 'node:assert/strict';
import test from 'node:test';
import { explainAnalytics } from '../../src/lib/analyticsInsights.ts';

test('analytics explanation reports recorded totals and an upward trend without causal claims', () => {
  const explanation = explainAnalytics([
    { date: '2026-08-01', studyHours: 0.5, tasksCompleted: 1, sessions: 1, understanding: 5 },
    { date: '2026-08-02', studyHours: 0.5, tasksCompleted: 0, sessions: 1, understanding: 6 },
    { date: '2026-08-03', studyHours: 2, tasksCompleted: 2, sessions: 2, understanding: 7 },
    { date: '2026-08-04', studyHours: 2, tasksCompleted: 1, sessions: 2, understanding: 8 },
  ]);

  assert.equal(explanation.totalHours, 5);
  assert.equal(explanation.totalTasks, 4);
  assert.equal(explanation.activeDays, 4);
  assert.equal(explanation.productiveDate, '2026-08-03');
  assert.equal(explanation.trend, 'up');
  assert.match(explanation.summary, /5\.0 recorded study hours/);
  assert.match(explanation.method, /selected timezone/);
});

test('analytics explanation calls out sparse or empty data instead of inventing a trend', () => {
  const empty = explainAnalytics([]);
  assert.equal(empty.trend, 'insufficient-data');
  assert.match(empty.summary, /No timer sessions/);

  const oneDay = explainAnalytics([
    { date: '2026-08-01', studyHours: Number.NaN, tasksCompleted: -2, sessions: -1, understanding: 99 },
  ]);
  assert.equal(oneDay.totalHours, 0);
  assert.equal(oneDay.totalTasks, 0);
  assert.equal(oneDay.trend, 'insufficient-data');
});
