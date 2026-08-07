'use client';
'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetchJSON } from '@/config/api';
import { GOAL_KEYS } from '@/lib/goalQueries';
import type { GoalActivityStatus, ShowUp } from '@/types/goals';

export interface BatchShowUpResult {
  goalId: string;
  date?: string;
  ok: boolean;
  entry?: ShowUp;
  error?: string;
}
export interface BatchShowUpResponse { results: BatchShowUpResult[] }
export interface BatchShowUpInput {
  goalIds?: string[];
  status: GoalActivityStatus;
  timezone: string;
  note?: string;
}

export const batchShowUpRequestInit = (input: BatchShowUpInput): RequestInit => {
  const { goalIds, ...allActiveInput } = input;
  const body = goalIds === undefined ? allActiveInput : input;
  return { method: 'POST', body: JSON.stringify(body) };
};

const cachedRangeContains = (key: readonly unknown[], date: string): boolean =>
  typeof key[4] === 'string' && typeof key[5] === 'string' && key[4] <= date && date <= key[5];

export const reconcileBatchShowUps = (client: QueryClient, response: BatchShowUpResponse): string[] => {
  const successfulIds: string[] = [];
  for (const result of response.results) {
    if (!result.ok || !result.entry) continue;
    successfulIds.push(result.goalId);
    const entry = result.entry;
    for (const [key, current] of client.getQueriesData<ShowUp[]>({ queryKey: [...GOAL_KEYS.activity(result.goalId), 'show-ups'] })) {
      if (!current || !cachedRangeContains(key, entry.date)) continue;
      client.setQueryData(key, [...current.filter((item) => item.date !== entry.date), entry]);
    }
    void client.invalidateQueries({ queryKey: GOAL_KEYS.activity(result.goalId), refetchType: 'active' });
  }
  return successfulIds;
};

export const useBatchShowUps = () => {
  const client = useQueryClient();
  return useMutation<BatchShowUpResponse, Error, BatchShowUpInput>({
    mutationFn: (input) => apiFetchJSON<BatchShowUpResponse>(
      '/goals/show-ups/batch',
      batchShowUpRequestInit(input)
    ),
    onSuccess: (response) => reconcileBatchShowUps(client, response),
  });
};
