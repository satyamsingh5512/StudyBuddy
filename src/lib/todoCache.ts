import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Todo } from '@/types/todo';

const TODOS_KEY = ['todos'] as const;

type TodoMutationState = {
  versions: Map<string, number>;
  pending: number;
};

export interface TodoEntityMutation {
  id: string;
  previous?: Todo;
  version: number;
}

export interface TodoMutationContext {
  entities: TodoEntityMutation[];
  optimisticId?: string;
}

const mutationStates = new WeakMap<QueryClient, TodoMutationState>();

const stateFor = (queryClient: QueryClient) => {
  let state = mutationStates.get(queryClient);
  if (!state) {
    state = { versions: new Map(), pending: 0 };
    mutationStates.set(queryClient, state);
  }
  return state;
};

const todoListOptions = (key: QueryKey) => {
  if (key[0] !== 'todos' || key[1] !== 'list' || typeof key[2] !== 'string') return null;
  return new URLSearchParams(key[2] === 'all' ? '' : key[2]);
};

export const todoBrowserTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const todoDateKey = (value?: string | Date, timezone = todoBrowserTimezone()) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value || '';
    const year = part('year');
    const month = part('month');
    const day = part('day');
    return year && month && day ? `${year}-${month}-${day}` : '';
  } catch {
    return '';
  }
};

/** Mirrors the bounded filters accepted by GET /todos. */
export const todoMatchesListKey = (todo: Todo, key: QueryKey, now = new Date()) => {
  const options = todoListOptions(key);
  if (!options) return false;
  const timezone = options.get('timezone') || todoBrowserTimezone();

  const completed = options.get('completed');
  if (completed !== null && todo.completed !== (completed === 'true')) return false;

  const scheduled = todoDateKey(todo.scheduledDate, timezone);
  const due = todoDateKey(todo.dueDate, timezone);
  const date = options.get('date');
  if (date && scheduled !== date && due !== date) return false;

  if (options.get('overdue') === 'true') {
    const today = todoDateKey(now, timezone);
    if (todo.completed || ((!scheduled || scheduled >= today) && (!due || due >= today)))
      return false;
  }

  return true;
};

const insertTodo = (todos: Todo[], todo: Todo, limit: number) => {
  const existing = todos.findIndex((candidate) => candidate.id === todo.id);
  if (existing >= 0) {
    const next = [...todos];
    next[existing] = todo;
    return next;
  }
  const next = [todo, ...todos];
  return Number.isFinite(limit) ? next.slice(0, limit) : next;
};

/** Re-evaluate one entity independently for every cached list filter. */
export const putTodoInCachedLists = (queryClient: QueryClient, todo: Todo) => {
  for (const [key, current] of queryClient.getQueriesData<Todo[]>({ queryKey: TODOS_KEY })) {
    if (!Array.isArray(current)) continue;
    const options = todoListOptions(key);
    if (!options) continue;
    const existing = current.some((candidate) => candidate.id === todo.id);
    if (!todoMatchesListKey(todo, key)) {
      if (existing)
        queryClient.setQueryData(
          key,
          current.filter((candidate) => candidate.id !== todo.id)
        );
      continue;
    }
    // Inserting into an offset page would guess the server-side page boundary.
    // Existing rows can still be patched/removed safely; background reconciliation
    // authoritatively fills shifted pages.
    if (!existing && Number(options.get('offset') || 0) > 0) continue;
    const limit = Number(options.get('limit') || Number.POSITIVE_INFINITY);
    queryClient.setQueryData(key, insertTodo(current, todo, limit));
  }
};

export const removeTodoFromCachedLists = (queryClient: QueryClient, id: string) => {
  for (const [key, current] of queryClient.getQueriesData<Todo[]>({ queryKey: TODOS_KEY })) {
    if (!Array.isArray(current) || !todoListOptions(key)) continue;
    if (current.some((todo) => todo.id === id)) {
      queryClient.setQueryData(
        key,
        current.filter((todo) => todo.id !== id)
      );
    }
  }
};

export const findCachedTodo = (queryClient: QueryClient, id: string) => {
  const detail = queryClient.getQueryData<Todo>(['todos', id]);
  if (detail) return detail;
  for (const [key, current] of queryClient.getQueriesData<Todo[]>({ queryKey: TODOS_KEY })) {
    if (!Array.isArray(current) || !todoListOptions(key)) continue;
    const todo = current.find((candidate) => candidate.id === id);
    if (todo) return todo;
  }
  return undefined;
};

export const findCachedTodos = (queryClient: QueryClient, predicate: (todo: Todo) => boolean) => {
  const found = new Map<string, Todo>();
  for (const [key, current] of queryClient.getQueriesData<Todo[]>({ queryKey: TODOS_KEY })) {
    if (!Array.isArray(current) || !todoListOptions(key)) continue;
    for (const todo of current)
      if (predicate(todo) && !found.has(todo.id)) found.set(todo.id, todo);
  }
  return [...found.values()];
};

/** Start one mutation, assigning a generation to each affected entity. */
export const beginTodoMutation = (
  queryClient: QueryClient,
  entities: Array<{ id: string; previous?: Todo }>
): TodoMutationContext => {
  const state = stateFor(queryClient);
  state.pending += 1;
  return {
    entities: entities.map(({ id, previous }) => {
      const version = (state.versions.get(id) || 0) + 1;
      state.versions.set(id, version);
      return { id, previous, version };
    }),
  };
};

export const isTodoMutationCurrent = (
  queryClient: QueryClient,
  entity: TodoEntityMutation | undefined
) => !!entity && stateFor(queryClient).versions.get(entity.id) === entity.version;

/** Roll back only entities that have not been superseded by a newer mutation. */
export const rollbackTodoMutation = (queryClient: QueryClient, context?: TodoMutationContext) => {
  for (const entity of context?.entities || []) {
    if (!isTodoMutationCurrent(queryClient, entity)) continue;
    if (entity.previous) putTodoInCachedLists(queryClient, entity.previous);
    else removeTodoFromCachedLists(queryClient, entity.id);
  }
};

/**
 * Reconcile only after the final overlapping Todo mutation settles. Active
 * queries refetch in the background, retaining their current arrays and avoiding
 * a page-level loading state.
 */
export const settleTodoMutation = (queryClient: QueryClient, context?: TodoMutationContext) => {
  if (!context) return;
  const state = stateFor(queryClient);
  state.pending = Math.max(0, state.pending - 1);
  if (state.pending === 0) {
    void queryClient.invalidateQueries({ queryKey: TODOS_KEY, refetchType: 'active' });
  }
};
