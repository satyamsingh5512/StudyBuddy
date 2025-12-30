/**
 * Granular Task Atoms with Atom Families
 * File: src/store/taskAtoms.ts
 * 
 * Optimizations:
 * 1. Atom families for per-task state (minimizes re-renders)
 * 2. Derived atoms for computed values
 * 3. Optimistic update support
 * 
 * Before: Single tasksAtom caused all TaskItem components to re-render
 * After: Only affected TaskItem re-renders on update
 */

import { atom } from 'jotai';
import { atomFamily, atomWithStorage } from 'jotai/utils';

// ============================================
// Types
// ============================================

export interface Task {
  id: string;
  title: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionsTarget: number;
  completed: boolean;
  createdAt: string;
  scheduledTime?: string;
}

// ============================================
// Base Atoms
// ============================================

// Task IDs list (lightweight, just IDs)
export const taskIdsAtom = atom<string[]>([]);

// Individual task atoms (atom family pattern)
export const taskAtomFamily = atomFamily(
  (id: string) => atom<Task | null>(null),
  (a, b) => a === b
);

// Loading state
export const tasksLoadingAtom = atom(false);

// Error state
export const tasksErrorAtom = atom<string | null>(null);

// ============================================
// Derived Atoms (Computed Values)
// ============================================

// All tasks (derived from IDs + family)
export const allTasksAtom = atom((get) => {
  const ids = get(taskIdsAtom);
  return ids
    .map((id) => get(taskAtomFamily(id)))
    .filter((task): task is Task => task !== null);
});

// Completed tasks count
export const completedCountAtom = atom((get) => {
  const tasks = get(allTasksAtom);
  return tasks.filter((t) => t.completed).length;
});

// Pending tasks count
export const pendingCountAtom = atom((get) => {
  const tasks = get(allTasksAtom);
  return tasks.filter((t) => !t.completed).length;
});

// Tasks by subject (for filtering)
export const tasksBySubjectAtom = atom((get) => {
  const tasks = get(allTasksAtom);
  return tasks.reduce((acc, task) => {
    if (!acc[task.subject]) {
      acc[task.subject] = [];
    }
    acc[task.subject].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
});

// ============================================
// Action Atoms (Write Operations)
// ============================================

// Set all tasks (for initial load)
export const setTasksAtom = atom(null, (get, set, tasks: Task[]) => {
  const ids = tasks.map((t) => t.id);
  set(taskIdsAtom, ids);
  
  for (const task of tasks) {
    set(taskAtomFamily(task.id), task);
  }
});

// Add a single task
export const addTaskAtom = atom(null, (get, set, task: Task) => {
  const ids = get(taskIdsAtom);
  set(taskIdsAtom, [task.id, ...ids]); // Prepend for newest first
  set(taskAtomFamily(task.id), task);
});

// Update a single task
export const updateTaskAtom = atom(null, (get, set, update: Partial<Task> & { id: string }) => {
  const existing = get(taskAtomFamily(update.id));
  if (existing) {
    set(taskAtomFamily(update.id), { ...existing, ...update });
  }
});

// Delete a task
export const deleteTaskAtom = atom(null, (get, set, id: string) => {
  const ids = get(taskIdsAtom);
  set(taskIdsAtom, ids.filter((i) => i !== id));
  set(taskAtomFamily(id), null);
});

// Toggle task completion
export const toggleTaskAtom = atom(null, (get, set, id: string) => {
  const task = get(taskAtomFamily(id));
  if (task) {
    set(taskAtomFamily(id), { ...task, completed: !task.completed });
  }
});

// ============================================
// Optimistic Update Helpers
// ============================================

// Create optimistic task (with temp ID)
export const createOptimisticTask = (data: Omit<Task, 'id' | 'createdAt'>): Task => ({
  ...data,
  id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  createdAt: new Date().toISOString(),
});

// Replace temp task with real task
export const replaceTempTaskAtom = atom(
  null,
  (get, set, { tempId, realTask }: { tempId: string; realTask: Task }) => {
    const ids = get(taskIdsAtom);
    set(taskIdsAtom, ids.map((id) => (id === tempId ? realTask.id : id)));
    set(taskAtomFamily(tempId), null);
    set(taskAtomFamily(realTask.id), realTask);
  }
);

// ============================================
// Persistence (Optional)
// ============================================

// Persist task IDs to localStorage for offline support
export const persistedTaskIdsAtom = atomWithStorage<string[]>('studybuddy-task-ids', []);

// Sync persisted IDs with main atom
export const syncPersistedTasksAtom = atom(null, (get, set) => {
  const persisted = get(persistedTaskIdsAtom);
  const current = get(taskIdsAtom);
  
  if (persisted.length > 0 && current.length === 0) {
    set(taskIdsAtom, persisted);
  }
});
