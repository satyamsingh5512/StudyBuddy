import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import {
  GOAL_KEYS,
  removeGoalEverywhere,
  replaceGoalEverywhere,
} from '../../src/lib/goalQueries.ts';
import type { Goal } from '../../src/types/goals.ts';

const active: Goal = {
  id: 'g',
  definitionVersion: 1,
  title: 'Exam goal',
  status: 'active',
  gridMode: 'daily',
  completionPolicy: 'manual',
  startDate: '2026-08-07',
  targetDate: null,
  subGoals: [],
  milestones: [],
  createdAt: '',
  updatedAt: '',
};

test('authoritative lifecycle response only moves matching goal between status lists', () => {
  const client = new QueryClient();
  const activeKey = GOAL_KEYS.list('active', 100, 0);
  const completedKey = GOAL_KEYS.list('completed', 100, 0);
  client.setQueryData(activeKey, [active]);
  client.setQueryData(completedKey, []);
  client.setQueryData(GOAL_KEYS.detail(active.id), active);
  const completed = { ...active, status: 'completed' as const };
  replaceGoalEverywhere(client, completed);
  assert.deepEqual(client.getQueryData(activeKey), []);
  assert.deepEqual(client.getQueryData(completedKey), [completed]);
  assert.deepEqual(client.getQueryData(GOAL_KEYS.detail(active.id)), completed);
});

test('accepted cleanup-pending deletion hides the goal immediately', () => {
  const client = new QueryClient();
  const activeKey = GOAL_KEYS.list('active', 100, 0);
  client.setQueryData(activeKey, [active]);
  client.setQueryData(GOAL_KEYS.detail(active.id), active);

  removeGoalEverywhere(client, active.id);

  assert.deepEqual(client.getQueryData(activeKey), []);
  assert.equal(client.getQueryData(GOAL_KEYS.detail(active.id)), undefined);
});
