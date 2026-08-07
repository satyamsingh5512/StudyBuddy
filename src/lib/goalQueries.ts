'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { apiFetchJSON, apiFetchList } from '@/config/api';
import { isValidGoalRange, rangeContainsDate, rangeOverlapsWeek, timezone } from '@/lib/goalDates';
import type {
  AddMilestoneInput,
  AddSubGoalInput,
  CreateGoalInput,
  DateKey,
  Goal,
  GoalCheckIn,
  GoalCompletion,
  GoalLifecycleAction,
  GoalListOptions,
  GoalRange,
  GoalStats,
  GoalStatus,
  Milestone,
  PatchGoalInput,
  PutGoalActivityInput,
  PutGoalCheckInInput,
  ReorderInput,
  ShowUp,
  SubGoal,
  UpdateMilestoneInput,
  UpdateSubGoalInput,
} from '@/types/goals';

export const GOAL_KEYS = {
  all: ['goals'] as const,
  lists: ['goals', 'list'] as const,
  list: (status: GoalStatus | undefined, limit: number, offset: number) =>
    ['goals', 'list', { status, limit, offset }] as const,
  detail: (id: string) => ['goals', 'detail', id] as const,
  activity: (id: string) => ['goals', 'activity', id] as const,
  completions: (id: string, range: GoalRange, tz: string) =>
    ['goals', 'activity', id, 'completions', range.from, range.to, tz] as const,
  showUps: (id: string, range: GoalRange, tz: string) =>
    ['goals', 'activity', id, 'show-ups', range.from, range.to, tz] as const,
  checkIns: (id: string, range: GoalRange, tz: string) =>
    ['goals', 'activity', id, 'check-ins', range.from, range.to, tz] as const,
  stats: (id: string, range: GoalRange, tz: string) =>
    ['goals', 'activity', id, 'stats', range.from, range.to, tz] as const,
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
const rangeQuery = (range: GoalRange, tz: string) =>
  new URLSearchParams({ from: range.from, to: range.to, timezone: tz }).toString();

const listStatus = (key: QueryKey): GoalStatus | undefined => {
  const value = key[2];
  if (!value || typeof value !== 'object' || !('status' in value)) return undefined;
  return (value as { status?: GoalStatus }).status;
};

export const replaceGoalEverywhere = (client: QueryClient, goal: Goal) => {
  const listEntries = client.getQueriesData<Goal[]>({ queryKey: GOAL_KEYS.lists });
  const wasKnown =
    Boolean(client.getQueryData<Goal>(GOAL_KEYS.detail(goal.id))) ||
    listEntries.some(([, data]) => data?.some((item) => item.id === goal.id));
  client.setQueryData(GOAL_KEYS.detail(goal.id), goal);
  for (const [key, data] of listEntries) {
    if (!data) continue;
    const status = listStatus(key);
    let next = data.filter((item) => item.id !== goal.id);
    if (wasKnown && (!status || status === goal.status)) next = [goal, ...next];
    client.setQueryData(key, next);
  }
};

interface GoalSnapshot {
  key: QueryKey;
  data: Goal | Goal[] | undefined;
}
const snapshotGoal = async (client: QueryClient, goalId: string): Promise<GoalSnapshot[]> => {
  await Promise.all([
    client.cancelQueries({ queryKey: GOAL_KEYS.lists }),
    client.cancelQueries({ queryKey: GOAL_KEYS.detail(goalId) }),
  ]);
  return [
    ...client
      .getQueriesData<Goal[]>({ queryKey: GOAL_KEYS.lists })
      .map(([key, data]) => ({ key, data })),
    { key: GOAL_KEYS.detail(goalId), data: client.getQueryData<Goal>(GOAL_KEYS.detail(goalId)) },
  ];
};
const restore = (client: QueryClient, snapshots?: GoalSnapshot[]) =>
  snapshots?.forEach(({ key, data }) => client.setQueryData(key, data));
const settleGoal = (client: QueryClient, id: string, activity = false) => {
  void client.invalidateQueries({ queryKey: GOAL_KEYS.lists });
  void client.invalidateQueries({ queryKey: GOAL_KEYS.detail(id) });
  if (activity) void client.invalidateQueries({ queryKey: GOAL_KEYS.activity(id) });
};

export const useGoals = (options: GoalListOptions = {}) => {
  const { status, limit = 100, offset = 0 } = options;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set('status', status);
  return useQuery<Goal[], Error>({
    queryKey: GOAL_KEYS.list(status, limit, offset),
    queryFn: () => apiFetchList<Goal>(`/goals?${params}`),
    placeholderData: [],
  });
};

export const useGoal = (id?: string) =>
  useQuery<Goal, Error>({
    queryKey: GOAL_KEYS.detail(id || ''),
    queryFn: () => apiFetchJSON<Goal>(`/goals/${id}`),
    enabled: Boolean(id),
  });

export const useCreateGoal = () => {
  const client = useQueryClient();
  return useMutation<Goal, Error, CreateGoalInput>({
    mutationFn: (input) => apiFetchJSON<Goal>('/goals', json('POST', input)),
    onSuccess: (goal) => {
      for (const [key, data] of client.getQueriesData<Goal[]>({ queryKey: GOAL_KEYS.lists })) {
        if (data && listStatus(key) === 'active')
          client.setQueryData(key, [goal, ...data.filter((item) => item.id !== goal.id)]);
      }
      client.setQueryData(GOAL_KEYS.detail(goal.id), goal);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: GOAL_KEYS.lists }),
  });
};

export const usePatchGoal = (id: string) => {
  const client = useQueryClient();
  return useMutation<Goal, Error, PatchGoalInput, { snapshots: GoalSnapshot[] }>({
    mutationFn: (input) => apiFetchJSON<Goal>(`/goals/${id}`, json('PATCH', input)),
    onMutate: async (input) => {
      const snapshots = await snapshotGoal(client, id);
      const current = client.getQueryData<Goal>(GOAL_KEYS.detail(id));
      if (current) {
        const optimistic: Goal = { ...current };
        if (input.title !== undefined) optimistic.title = input.title;
        if (input.description !== undefined) optimistic.description = input.description;
        if (input.gridMode !== undefined) optimistic.gridMode = input.gridMode;
        if (input.completionPolicy !== undefined)
          optimistic.completionPolicy = input.completionPolicy;
        if (input.startDate !== undefined) optimistic.startDate = input.startDate;
        if (input.targetDate !== undefined) optimistic.targetDate = input.targetDate;
        replaceGoalEverywhere(client, optimistic);
      }
      return { snapshots };
    },
    onError: (_error, _input, context) => restore(client, context?.snapshots),
    onSuccess: (goal) => replaceGoalEverywhere(client, goal),
    onSettled: (_data, _error, input) =>
      settleGoal(
        client,
        id,
        Boolean(
          input &&
            ('startDate' in input ||
              'targetDate' in input ||
              'gridMode' in input ||
              'completionPolicy' in input ||
              'subGoals' in input)
        )
      ),
  });
};

export const removeGoalEverywhere = (client: QueryClient, id: string) => {
  for (const [key, data] of client.getQueriesData<Goal[]>({ queryKey: GOAL_KEYS.lists })) {
    if (data)
      client.setQueryData(
        key,
        data.filter((goal) => goal.id !== id)
      );
  }
  client.removeQueries({ queryKey: GOAL_KEYS.detail(id), exact: true });
};

export interface GoalDeletePending {
  status: 'cleanup_pending';
  cleanupPending: true;
}

export const useDeleteGoal = () => {
  const client = useQueryClient();
  return useMutation<GoalDeletePending | void, Error, string, { snapshots: GoalSnapshot[] }>({
    mutationFn: (id) => apiFetchJSON<GoalDeletePending | void>(`/goals/${id}`, json('DELETE')),
    onMutate: async (id) => {
      const snapshots = await snapshotGoal(client, id);
      removeGoalEverywhere(client, id);
      return { snapshots };
    },
    onError: (_error, _id, context) => restore(client, context?.snapshots),
    onSuccess: (_data, id) => client.removeQueries({ queryKey: GOAL_KEYS.activity(id) }),
    onSettled: () => void client.invalidateQueries({ queryKey: GOAL_KEYS.lists }),
  });
};

export const useGoalLifecycle = (id: string) => {
  const client = useQueryClient();
  return useMutation<Goal, Error, GoalLifecycleAction>({
    mutationFn: (action) => apiFetchJSON<Goal>(`/goals/${id}/${action}`, json('POST')),
    onSuccess: (goal) => replaceGoalEverywhere(client, goal),
    onSettled: () => settleGoal(client, id, true),
  });
};

type ItemKind = 'sub-goals' | 'milestones';
const useItemMutation = <Variables>(
  id: string,
  kind: ItemKind,
  request: (variables: Variables) => Promise<Goal>,
  activity: boolean
) => {
  const client = useQueryClient();
  return useMutation<Goal, Error, Variables>({
    mutationFn: request,
    onSuccess: (goal) => replaceGoalEverywhere(client, goal),
    onSettled: () => settleGoal(client, id, activity),
  });
};

export const useAddSubGoal = (id: string) =>
  useItemMutation<AddSubGoalInput>(
    id,
    'sub-goals',
    (input) => apiFetchJSON<Goal>(`/goals/${id}/sub-goals`, json('POST', input)),
    true
  );
export const useUpdateSubGoal = (id: string) =>
  useItemMutation<{ subGoalId: string; input: UpdateSubGoalInput }>(
    id,
    'sub-goals',
    ({ subGoalId, input }) =>
      apiFetchJSON<Goal>(`/goals/${id}/sub-goals/${subGoalId}`, json('PATCH', input)),
    true
  );
export const useDeleteSubGoal = (id: string) =>
  useItemMutation<string>(
    id,
    'sub-goals',
    (subGoalId) => apiFetchJSON<Goal>(`/goals/${id}/sub-goals/${subGoalId}`, json('DELETE')),
    true
  );
export const useReorderSubGoals = (id: string) =>
  useItemMutation<ReorderInput>(
    id,
    'sub-goals',
    (input) => apiFetchJSON<Goal>(`/goals/${id}/sub-goals/reorder`, json('PATCH', input)),
    true
  );
export const useAddMilestone = (id: string) =>
  useItemMutation<AddMilestoneInput>(
    id,
    'milestones',
    (input) => apiFetchJSON<Goal>(`/goals/${id}/milestones`, json('POST', input)),
    false
  );
export const useUpdateMilestone = (id: string) =>
  useItemMutation<{ milestoneId: string; input: UpdateMilestoneInput }>(
    id,
    'milestones',
    ({ milestoneId, input }) =>
      apiFetchJSON<Goal>(`/goals/${id}/milestones/${milestoneId}`, json('PATCH', input)),
    false
  );
export const useDeleteMilestone = (id: string) =>
  useItemMutation<string>(
    id,
    'milestones',
    (milestoneId) => apiFetchJSON<Goal>(`/goals/${id}/milestones/${milestoneId}`, json('DELETE')),
    false
  );
export const useReorderMilestones = (id: string) =>
  useItemMutation<ReorderInput>(
    id,
    'milestones',
    (input) => apiFetchJSON<Goal>(`/goals/${id}/milestones/reorder`, json('PATCH', input)),
    false
  );

const useRangeQuery = <T>(
  id: string | undefined,
  kind: 'completions' | 'show-ups' | 'check-ins' | 'stats',
  range: GoalRange
) => {
  const tz = timezone();
  const key =
    kind === 'completions'
      ? GOAL_KEYS.completions(id || '', range, tz)
      : kind === 'show-ups'
        ? GOAL_KEYS.showUps(id || '', range, tz)
        : kind === 'check-ins'
          ? GOAL_KEYS.checkIns(id || '', range, tz)
          : GOAL_KEYS.stats(id || '', range, tz);
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: async () => {
      const data = await apiFetchJSON<T>(`/goals/${id}/${kind}?${rangeQuery(range, tz)}`);
      // Collection endpoints are rendered with `.map`; stats is a single object.
      // Coerce unexpected collection payloads so a malformed response cannot
      // throw during render.
      if (kind !== 'stats' && !Array.isArray(data)) return [] as unknown as T;
      return data;
    },
    enabled: Boolean(id) && isValidGoalRange(range),
  });
};
export const useGoalCompletions = (id: string | undefined, range: GoalRange) =>
  useRangeQuery<GoalCompletion[]>(id, 'completions', range);
export const useGoalShowUps = (id: string | undefined, range: GoalRange) =>
  useRangeQuery<ShowUp[]>(id, 'show-ups', range);
export const useGoalCheckIns = (id: string | undefined, range: GoalRange) =>
  useRangeQuery<GoalCheckIn[]>(id, 'check-ins', range);
export const useGoalStats = (id: string | undefined, range: GoalRange) =>
  useRangeQuery<GoalStats>(id, 'stats', range);

export const goalActivityPath = (path: string, tz = timezone()): string => {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${new URLSearchParams({ timezone: tz }).toString()}`;
};

interface ActivityKeyParts {
  kind: string;
  range: GoalRange;
}
const activityParts = (key: QueryKey): ActivityKeyParts | null =>
  typeof key[3] === 'string' && typeof key[4] === 'string' && typeof key[5] === 'string'
    ? { kind: key[3], range: { from: key[4], to: key[5] } }
    : null;
interface EntitySnapshot<T> {
  key: QueryKey;
  entries: T[];
}
interface ActivityMutationContext<T> {
  entityKey: string;
  revision: number;
  snapshots: EntitySnapshot<T>[];
}

const activityMutationRevisions = new Map<string, number>();
export const beginActivityMutation = (entityKey: string): number => {
  const revision = (activityMutationRevisions.get(entityKey) || 0) + 1;
  activityMutationRevisions.set(entityKey, revision);
  return revision;
};
export const isCurrentActivityMutation = (entityKey: string, revision: number): boolean =>
  activityMutationRevisions.get(entityKey) === revision;
export const applyIfCurrentActivityMutation = (
  entityKey: string,
  revision: number,
  apply: () => void
): boolean => {
  if (!isCurrentActivityMutation(entityKey, revision)) return false;
  apply();
  return true;
};

export const replaceActivityEntity = <T>(
  data: T[],
  matches: (item: T) => boolean,
  replacement: T[]
): T[] => [...data.filter((item) => !matches(item)), ...replacement];

const snapshotEntity = async <T>(
  client: QueryClient,
  prefix: QueryKey,
  matches: (item: T) => boolean,
  applies: (key: QueryKey) => boolean
): Promise<EntitySnapshot<T>[]> => {
  await client.cancelQueries({ queryKey: prefix });
  return client
    .getQueriesData<T[]>({ queryKey: prefix })
    .flatMap(([key, data]) =>
      data && applies(key) ? [{ key, entries: data.filter(matches) }] : []
    );
};
const updateEntity = <T>(
  client: QueryClient,
  prefix: QueryKey,
  matches: (item: T) => boolean,
  applies: (key: QueryKey) => boolean,
  replacement: T[]
) => {
  for (const [key, data] of client.getQueriesData<T[]>({ queryKey: prefix })) {
    if (data && applies(key))
      client.setQueryData(key, replaceActivityEntity(data, matches, replacement));
  }
};
const restoreEntity = <T>(
  client: QueryClient,
  matches: (item: T) => boolean,
  snapshots: EntitySnapshot<T>[]
) => {
  for (const { key, entries } of snapshots) {
    const current = client.getQueryData<T[]>(key);
    if (current) client.setQueryData(key, replaceActivityEntity(current, matches, entries));
  }
};
const dateApplies = (date: DateKey) => (key: QueryKey) => {
  const parts = activityParts(key);
  return Boolean(parts && rangeContainsDate(parts.range, date));
};
const weekApplies = (weekStart: DateKey) => (key: QueryKey) => {
  const parts = activityParts(key);
  return Boolean(parts && rangeOverlapsWeek(parts.range, weekStart));
};
const reconcileGoalActivity = (client: QueryClient, goalId: string) =>
  client.invalidateQueries({ queryKey: GOAL_KEYS.activity(goalId) });
const activityScope = (goalId: string, kind: 'completions' | 'show-ups' | 'check-ins') => ({
  id: `goal-activity:${goalId}:${kind}`,
});

interface CompletionVariables {
  subGoalId: string;
  date: DateKey;
  input: PutGoalActivityInput;
}
export const usePutGoalCompletion = (goalId: string) => {
  const client = useQueryClient();
  const prefix = [...GOAL_KEYS.activity(goalId), 'completions'] as const;
  return useMutation<
    GoalCompletion,
    Error,
    CompletionVariables,
    ActivityMutationContext<GoalCompletion>
  >({
    scope: activityScope(goalId, 'completions'),
    mutationFn: ({ subGoalId, date, input }) =>
      apiFetchJSON<GoalCompletion>(
        goalActivityPath(`/goals/${goalId}/sub-goals/${subGoalId}/completions/${date}`),
        json('PUT', input)
      ),
    onMutate: async ({ subGoalId, date, input }) => {
      const entityKey = `${goalId}:completion:${date}:${subGoalId}`;
      const revision = beginActivityMutation(entityKey);
      const matches = (item: GoalCompletion) => item.date === date && item.subGoalId === subGoalId;
      const applies = dateApplies(date);
      const snapshots = await snapshotEntity(client, prefix, matches, applies);
      if (isCurrentActivityMutation(entityKey, revision)) {
        const optimistic: GoalCompletion = {
          id: `optimistic-${revision}-${subGoalId}-${date}`,
          goalId,
          subGoalId,
          definitionVersion: 0,
          date,
          status: input.status,
          source: 'manual',
          note: input.note,
          createdAt: '',
          updatedAt: '',
        };
        updateEntity(client, prefix, matches, applies, [optimistic]);
      }
      return { entityKey, revision, snapshots };
    },
    onError: (_error, variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        restoreEntity(
          client,
          (item: GoalCompletion) =>
            item.date === variables.date && item.subGoalId === variables.subGoalId,
          context.snapshots
        )
      ),
    onSuccess: (saved, _variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        updateEntity(
          client,
          prefix,
          (item) => item.date === saved.date && item.subGoalId === saved.subGoalId,
          dateApplies(saved.date),
          [saved]
        )
      ),
    onSettled: () => reconcileGoalActivity(client, goalId),
  });
};

export const useDeleteGoalCompletion = (goalId: string) => {
  const client = useQueryClient();
  const prefix = [...GOAL_KEYS.activity(goalId), 'completions'] as const;
  return useMutation<
    void,
    Error,
    { subGoalId: string; date: DateKey },
    ActivityMutationContext<GoalCompletion>
  >({
    scope: activityScope(goalId, 'completions'),
    mutationFn: ({ subGoalId, date }) =>
      apiFetchJSON<void>(
        goalActivityPath(`/goals/${goalId}/sub-goals/${subGoalId}/completions/${date}`),
        json('DELETE')
      ),
    onMutate: async ({ subGoalId, date }) => {
      const entityKey = `${goalId}:completion:${date}:${subGoalId}`;
      const revision = beginActivityMutation(entityKey);
      const matches = (item: GoalCompletion) => item.date === date && item.subGoalId === subGoalId;
      const applies = dateApplies(date);
      const snapshots = await snapshotEntity(client, prefix, matches, applies);
      if (isCurrentActivityMutation(entityKey, revision))
        updateEntity(client, prefix, matches, applies, []);
      return { entityKey, revision, snapshots };
    },
    onError: (_error, variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        restoreEntity(
          client,
          (item: GoalCompletion) =>
            item.date === variables.date && item.subGoalId === variables.subGoalId,
          context.snapshots
        )
      ),
    onSettled: () => reconcileGoalActivity(client, goalId),
  });
};

interface ShowUpVariables {
  date: DateKey;
  input: PutGoalActivityInput;
}
export const usePutShowUp = (goalId: string) => {
  const client = useQueryClient();
  const prefix = [...GOAL_KEYS.activity(goalId), 'show-ups'] as const;
  return useMutation<ShowUp, Error, ShowUpVariables, ActivityMutationContext<ShowUp>>({
    scope: activityScope(goalId, 'show-ups'),
    mutationFn: ({ date, input }) =>
      apiFetchJSON<ShowUp>(
        goalActivityPath(`/goals/${goalId}/show-ups/${date}`),
        json('PUT', input)
      ),
    onMutate: async ({ date, input }) => {
      const entityKey = `${goalId}:show-up:${date}`;
      const revision = beginActivityMutation(entityKey);
      const matches = (item: ShowUp) => item.date === date;
      const applies = dateApplies(date);
      const snapshots = await snapshotEntity(client, prefix, matches, applies);
      if (isCurrentActivityMutation(entityKey, revision)) {
        const optimistic: ShowUp = {
          id: `optimistic-${revision}-${date}`,
          goalId,
          date,
          status: input.status,
          source: 'manual',
          note: input.note,
          createdAt: '',
          updatedAt: '',
        };
        updateEntity(client, prefix, matches, applies, [optimistic]);
      }
      return { entityKey, revision, snapshots };
    },
    onError: (_error, variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        restoreEntity(client, (item: ShowUp) => item.date === variables.date, context.snapshots)
      ),
    onSuccess: (saved, _variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        updateEntity(client, prefix, (item) => item.date === saved.date, dateApplies(saved.date), [
          saved,
        ])
      ),
    onSettled: () => reconcileGoalActivity(client, goalId),
  });
};

export const useDeleteShowUp = (goalId: string) => {
  const client = useQueryClient();
  const prefix = [...GOAL_KEYS.activity(goalId), 'show-ups'] as const;
  return useMutation<void, Error, DateKey, ActivityMutationContext<ShowUp>>({
    scope: activityScope(goalId, 'show-ups'),
    mutationFn: (date) =>
      apiFetchJSON<void>(goalActivityPath(`/goals/${goalId}/show-ups/${date}`), json('DELETE')),
    onMutate: async (date) => {
      const entityKey = `${goalId}:show-up:${date}`;
      const revision = beginActivityMutation(entityKey);
      const matches = (item: ShowUp) => item.date === date;
      const applies = dateApplies(date);
      const snapshots = await snapshotEntity(client, prefix, matches, applies);
      if (isCurrentActivityMutation(entityKey, revision))
        updateEntity(client, prefix, matches, applies, []);
      return { entityKey, revision, snapshots };
    },
    onError: (_error, date, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        restoreEntity(client, (item: ShowUp) => item.date === date, context.snapshots)
      ),
    onSettled: () => reconcileGoalActivity(client, goalId),
  });
};

export const usePutGoalCheckIn = (goalId: string) => {
  const client = useQueryClient();
  const prefix = [...GOAL_KEYS.activity(goalId), 'check-ins'] as const;
  return useMutation<
    GoalCheckIn,
    Error,
    { weekStart: DateKey; input: PutGoalCheckInInput },
    ActivityMutationContext<GoalCheckIn>
  >({
    scope: activityScope(goalId, 'check-ins'),
    mutationFn: ({ weekStart, input }) =>
      apiFetchJSON<GoalCheckIn>(
        goalActivityPath(`/goals/${goalId}/check-ins/${weekStart}`),
        json('PUT', input)
      ),
    onMutate: async ({ weekStart, input }) => {
      const entityKey = `${goalId}:check-in:${weekStart}`;
      const revision = beginActivityMutation(entityKey);
      const matches = (item: GoalCheckIn) => item.weekStart === weekStart;
      const applies = weekApplies(weekStart);
      const snapshots = await snapshotEntity(client, prefix, matches, applies);
      if (isCurrentActivityMutation(entityKey, revision)) {
        const optimistic: GoalCheckIn = {
          id: `optimistic-${revision}-${weekStart}`,
          goalId,
          weekStart,
          ...input,
          createdAt: '',
          updatedAt: '',
        };
        updateEntity(client, prefix, matches, applies, [optimistic]);
      }
      return { entityKey, revision, snapshots };
    },
    onError: (_error, variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        restoreEntity(
          client,
          (item: GoalCheckIn) => item.weekStart === variables.weekStart,
          context.snapshots
        )
      ),
    onSuccess: (saved, _variables, context) =>
      context &&
      applyIfCurrentActivityMutation(context.entityKey, context.revision, () =>
        updateEntity(
          client,
          prefix,
          (item) => item.weekStart === saved.weekStart,
          weekApplies(saved.weekStart),
          [saved]
        )
      ),
    onSettled: () => reconcileGoalActivity(client, goalId),
  });
};

export type { Goal, GoalCheckIn, GoalCompletion, GoalStats, Milestone, ShowUp, SubGoal };
