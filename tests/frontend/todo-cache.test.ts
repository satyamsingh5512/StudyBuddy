import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
  beginTodoMutation,
  putTodoInCachedLists,
  removeTodoFromCachedLists,
  rollbackTodoMutation,
  todoDateKey,
  todoMatchesListKey,
} from '../../src/lib/todoCache.ts';
import { todoQueryString } from '../../src/lib/queries.ts';
import type { Todo } from '../../src/types/todo.ts';

const allKey = ['todos', 'list', 'timezone=UTC'] as const;
const overdueKey = [
  'todos',
  'list',
  'overdue=true&completed=false&limit=200&timezone=UTC',
] as const;
const incompleteKey = ['todos', 'list', 'completed=false&timezone=UTC'] as const;
const completedKey = ['todos', 'list', 'completed=true&timezone=UTC'] as const;
const oldDateKey = ['todos', 'list', 'date=2000-01-01&limit=200&timezone=UTC'] as const;
const futureDateKey = ['todos', 'list', 'date=2999-01-01&limit=200&timezone=UTC'] as const;

const todo: Todo = {
  id: 'todo-1',
  title: 'Revise mechanics',
  subject: 'Physics',
  difficulty: 'medium',
  questionsTarget: 20,
  completed: false,
  scheduledDate: '2000-01-01T00:00:00.000Z',
  dueDate: '2000-01-01T00:00:00.000Z',
  createdAt: '2000-01-01T00:00:00.000Z',
};

const clientWithLists = () => {
  const client = new QueryClient();
  for (const key of [allKey, overdueKey, incompleteKey, completedKey, oldDateKey, futureDateKey]) {
    client.setQueryData<Todo[]>(key, []);
  }
  return client;
};

const ids = (client: QueryClient, key: readonly unknown[]) =>
  (client.getQueryData<Todo[]>(key) || []).map((entry) => entry.id);

test('create enters only cached Todo lists whose filters match', () => {
  const client = clientWithLists();
  putTodoInCachedLists(client, todo);

  assert.deepEqual(ids(client, allKey), [todo.id]);
  assert.deepEqual(ids(client, overdueKey), [todo.id]);
  assert.deepEqual(ids(client, incompleteKey), [todo.id]);
  assert.deepEqual(ids(client, oldDateKey), [todo.id]);
  assert.deepEqual(ids(client, completedKey), []);
  assert.deepEqual(ids(client, futureDateKey), []);
});

test('toggle and reschedule remove and add Todo membership per list filter', () => {
  const client = clientWithLists();
  putTodoInCachedLists(client, todo);

  const completed = { ...todo, completed: true };
  putTodoInCachedLists(client, completed);
  assert.deepEqual(ids(client, allKey), [todo.id]);
  assert.deepEqual(ids(client, completedKey), [todo.id]);
  assert.deepEqual(ids(client, incompleteKey), []);
  assert.deepEqual(ids(client, overdueKey), []);

  const rescheduled = {
    ...completed,
    completed: false,
    scheduledDate: '2999-01-01T00:00:00.000Z',
    dueDate: '2999-01-01T00:00:00.000Z',
  };
  putTodoInCachedLists(client, rescheduled);
  assert.deepEqual(ids(client, completedKey), []);
  assert.deepEqual(ids(client, incompleteKey), [todo.id]);
  assert.deepEqual(ids(client, oldDateKey), []);
  assert.deepEqual(ids(client, futureDateKey), [todo.id]);
  assert.deepEqual(ids(client, overdueKey), []);
});

test('an older failed mutation cannot resurrect an entity deleted by a later success', () => {
  const client = clientWithLists();
  putTodoInCachedLists(client, todo);

  const older = beginTodoMutation(client, [{ id: todo.id, previous: todo }]);
  const toggled = { ...todo, completed: true };
  putTodoInCachedLists(client, toggled);

  // A newer delete starts from the optimistic toggle and succeeds.
  beginTodoMutation(client, [{ id: todo.id, previous: toggled }]);
  removeTodoFromCachedLists(client, todo.id);

  // The older request fails after the delete. Its generation is stale, so its
  // rollback must not restore any whole list or this entity.
  rollbackTodoMutation(client, older);
  for (const key of [allKey, overdueKey, incompleteKey, completedKey, oldDateKey, futureDateKey]) {
    assert.deepEqual(ids(client, key), [], `stale rollback changed ${key.join('/')}`);
  }
});

test('Asia/Kolkata membership uses local Aug 8 midnight at Aug 7T18:30Z', () => {
  const dateKey = ['todos', 'list', 'date=2026-08-08&timezone=Asia%2FKolkata'] as const;
  const overdueKey = [
    'todos',
    'list',
    'overdue=true&completed=false&timezone=Asia%2FKolkata',
  ] as const;
  const now = new Date('2026-08-08T06:30:00.000Z');
  const atMidnight: Todo = {
    ...todo,
    id: 'kolkata-midnight',
    scheduledDate: '2026-08-07T18:30:00.000Z',
    dueDate: undefined,
  };
  const beforeMidnight: Todo = {
    ...todo,
    id: 'kolkata-overdue',
    scheduledDate: '2026-08-07T18:29:59.999Z',
    dueDate: undefined,
  };

  assert.equal(todoDateKey(atMidnight.scheduledDate, 'Asia/Kolkata'), '2026-08-08');
  assert.equal(todoMatchesListKey(atMidnight, dateKey, now), true);
  assert.equal(todoMatchesListKey(beforeMidnight, dateKey, now), false);
  assert.equal(todoMatchesListKey(atMidnight, overdueKey, now), false);
  assert.equal(todoMatchesListKey(beforeMidnight, overdueKey, now), true);
});

test('todo list queries include the browser IANA timezone', () => {
  assert.equal(
    todoQueryString({ date: '2026-08-08', limit: 200, timezone: 'Asia/Kolkata' }),
    'date=2026-08-08&limit=200&timezone=Asia%2FKolkata'
  );
});
