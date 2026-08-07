'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { Check, ListTodo, Plus, Trash2 } from 'lucide-react';
import { useCreateTodo, useDeleteTodo, useTodos, useToggleTodo } from '@/lib/queries';
import type { Todo } from '@/types/todo';
import { useToast } from '@/components/ui/use-toast';

type TaskFilter = 'open' | 'all' | 'done';

const FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
];

const localMidnightISO = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const shortDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  const days = Math.round((candidate.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface TaskRowProps {
  task: Todo;
  onToggle: (task: Todo) => void;
  onDelete: (task: Todo) => void;
  busy: boolean;
}

/** Memoized row; completion animation is compositor-only (scale + opacity). */
const TaskRow = memo(function TaskRow({ task, onToggle, onDelete, busy }: TaskRowProps) {
  const date = shortDate(task.scheduledDate || task.dueDate);

  return (
    <li
      className={`group flex min-h-14 items-center gap-3 border-b border-hairline py-3 last:border-0 transition-opacity duration-200 ${
        task.optimistic ? 'opacity-55' : 'opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy || task.optimistic}
        aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}
        className={`press relative grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border disabled:cursor-wait ${
          task.completed
            ? 'border-brand bg-brand text-on-accent'
            : 'border-hairline-strong bg-surface hover:border-hairline-accent-strong'
        }`}
      >
        {task.completed && <Check className="h-3.5 w-3.5 animate-task-check" strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy || task.optimistic}
        className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-wait"
      >
        <span
          className={`block truncate text-[14px] font-medium tracking-[-0.015em] transition-colors ${
            task.completed ? 'text-muted-ink line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </span>
        {(date || task.subject) && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-ink">
            {[task.subject && task.subject !== 'General' ? task.subject : '', date]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onDelete(task)}
        disabled={busy || task.optimistic}
        aria-label={`Delete ${task.title}`}
        className="press grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-ink opacity-60 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 disabled:cursor-wait sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
});

export default function Tasks() {
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('open');
  const { toast } = useToast();
  const todosQuery = useTodos({ limit: 200 });
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const todos = useMemo(() => {
    const all = todosQuery.data || [];
    return all.filter((todo) => {
      if (filter === 'open') return !todo.completed;
      if (filter === 'done') return todo.completed;
      return true;
    });
  }, [filter, todosQuery.data]);

  const totals = useMemo(() => {
    const all = todosQuery.data || [];
    const completed = all.reduce((count, todo) => count + Number(todo.completed), 0);
    return { all: all.length, completed, open: all.length - completed };
  }, [todosQuery.data]);

  const addTask = useCallback(async () => {
    const nextTitle = title.trim();
    if (!nextTitle || createTodo.isPending) return;

    setTitle('');
    try {
      await createTodo.mutateAsync({
        title: nextTitle,
        subject: 'General',
        difficulty: 'medium',
        questionsTarget: 10,
        scheduledDate: localMidnightISO(),
      });
    } catch {
      setTitle(nextTitle);
      toast({ title: 'Task was not saved', description: 'Try again.', variant: 'destructive' });
    }
  }, [createTodo, title, toast]);

  const handleToggle = useCallback(
    async (task: Todo) => {
      try {
        await toggleTodo.mutateAsync({ id: task.id, completed: !task.completed });
      } catch {
        toast({ title: 'Task was not updated', description: 'Your previous state was restored.', variant: 'destructive' });
      }
    },
    [toggleTodo, toast]
  );

  const handleDelete = useCallback(
    async (task: Todo) => {
      try {
        await deleteTodo.mutateAsync(task.id);
      } catch {
        toast({ title: 'Task was not deleted', description: 'The task was restored.', variant: 'destructive' });
      }
    },
    [deleteTodo, toast]
  );

  const activeMutationId =
    (toggleTodo.variables && toggleTodo.isPending ? toggleTodo.variables.id : '') ||
    (deleteTodo.variables && deleteTodo.isPending ? deleteTodo.variables : '');

  return (
    <section className="mx-auto w-full max-w-[680px] pb-24 pt-2 sm:pt-6">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">Quick capture</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Tasks</h1>
        </div>
        <div className="text-right text-[12px] text-muted-ink">
          <span className="font-medium text-ink">{totals.open}</span> open
        </div>
      </header>

      <div className="rounded-2xl border border-hairline bg-surface">
        <div className="flex items-center gap-2 border-b border-hairline p-3 sm:p-4">
          <Plus className="h-4 w-4 shrink-0 text-muted-ink" />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addTask();
              }
            }}
            maxLength={300}
            placeholder="Add a task"
            aria-label="Add a task"
            className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-ink outline-none placeholder:text-muted-ink"
          />
          <button
            type="button"
            onClick={() => void addTask()}
            disabled={!title.trim() || createTodo.isPending}
            className="press rounded-xl bg-brand px-3 py-2 text-[12px] font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2 sm:px-4">
          <div className="flex gap-1" role="group" aria-label="Task filters">
            {FILTERS.map((item) => {
              const selected = filter === item.value;
              const count =
                item.value === 'open'
                  ? totals.open
                  : item.value === 'done'
                    ? totals.completed
                    : totals.all;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(item.value)}
                  className={`press rounded-lg px-2.5 py-1.5 text-[11px] ${
                    selected ? 'bg-ink text-surface' : 'text-muted-ink hover:bg-ink/[0.04]'
                  }`}
                >
                  {item.label} {count}
                </button>
              );
            })}
          </div>
        </div>

        {todosQuery.isLoading ? (
          <div className="space-y-1 p-4" aria-label="Loading tasks">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-ink/[0.035]" />
            ))}
          </div>
        ) : todosQuery.isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ink">Could not load tasks.</p>
            <button
              type="button"
              onClick={() => void todosQuery.refetch()}
              className="mt-3 text-[12px] text-brand hover:underline"
            >
              Try again
            </button>
          </div>
        ) : todos.length ? (
          <ul className="px-3 sm:px-4">
            {todos.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onDelete={handleDelete}
                busy={activeMutationId === task.id}
              />
            ))}
          </ul>
        ) : (
          <div className="grid min-h-48 place-items-center p-8 text-center">
            <div>
              <ListTodo className="mx-auto mb-3 h-6 w-6 text-muted-ink" />
              <p className="text-sm font-medium text-ink">
                {filter === 'done' ? 'No completed tasks yet' : 'Nothing waiting'}
              </p>
              <p className="mt-1 text-[12px] text-muted-ink">
                {filter === 'done' ? 'Completed tasks will appear here.' : 'Add your next small step above.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-ink">
        Changes appear instantly and sync in the background.
      </p>
    </section>
  );
}
