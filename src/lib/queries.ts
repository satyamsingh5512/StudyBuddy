/**
 * Custom React Query Hooks for StudyBuddy
 * 
 * OPTIMIZATION: Centralized data fetching with automatic caching, deduplication,
 * background refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchJSON, apiFetchList } from '@/config/api';
import {
  beginTodoMutation,
  findCachedTodo,
  findCachedTodos,
  isTodoMutationCurrent,
  putTodoInCachedLists,
  removeTodoFromCachedLists,
  rollbackTodoMutation,
  settleTodoMutation,
  todoBrowserTimezone,
  todoDateKey,
  type TodoMutationContext,
} from '@/lib/todoCache';
import type { CreateTodoInput, Todo, UpdateTodoInput } from '@/types/todo';
import type { User } from '@/store/atoms';
import type { UserPreferences } from '@/types/content';

export interface UpdateProfileInput {
  name?: string;
  examGoal?: string;
  examDate?: Date;
  studentClass?: string;
  batch?: string;
  syllabus?: string;
  subjects?: string[];
  statsResetAt?: Date | null;
  timezone?: string;
  showProfile?: boolean;
  preferences?: Partial<UserPreferences>;
}

// ============================================================================
// CACHE KEYS
// ============================================================================

export const QUERY_KEYS = {
  todos: () => ['todos'] as const,
  todo: (id: string) => ['todos', id] as const,
  todosByDate: (date: string) => ['todos', 'date', date] as const,
  todosOverdue: () => ['todos', 'overdue'] as const,
  todosToday: () => ['todos', 'today'] as const,
  dailyEfficiency: (days?: number) => ['efficiency', days ?? 1] as const,
  timerAnalytics: (days: number, timezone: string) =>
    ['timer', 'analytics', days, timezone] as const,
  news: (examType: string) => ['news', examType] as const,
  newsDates: (examType: string) => ['news', examType, 'dates'] as const,
  messages: (userId?: string) => ['messages', userId] as const,
  conversations: () => ['conversations'] as const,
  reports: () => ['reports'] as const,
  userStats: () => ['userStats'] as const,
  profile: () => ['profile'] as const,
  leaderboard: () => ['leaderboard'] as const,
  friends: () => ['friends'] as const,
  friendRequests: () => ['friendRequests'] as const,
  blockedUsers: () => ['blockedUsers'] as const,
  searchUsers: (query: string) => ['searchUsers', query] as const,
  notes: () => ['notes'] as const,
  note: (id: string) => ['notes', id] as const,
};

// ============================================================================
// TODOS HOOKS
// ============================================================================

/**
 * Fetch Todos with bounded server-side filtering. All list keys share the
 * `['todos']` prefix so optimistic writes update every mounted Todo view.
 */
export interface TodoQueryOptions {
  date?: string;
  overdue?: boolean;
  completed?: boolean;
  limit?: number;
  offset?: number;
  timezone?: string;
}

export const todoQueryString = (options: TodoQueryOptions) => {
  const params = new URLSearchParams();
  if (options.date) params.set('date', options.date);
  if (typeof options.overdue === 'boolean') params.set('overdue', String(options.overdue));
  if (typeof options.completed === 'boolean') params.set('completed', String(options.completed));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  params.set('timezone', options.timezone || todoBrowserTimezone());
  return params.toString();
};

export const useTodos = (options: TodoQueryOptions = {}) => {
  const query = todoQueryString(options);
  return useQuery<Todo[], Error>({
    queryKey: [...QUERY_KEYS.todos(), 'list', query || 'all'],
    queryFn: () => apiFetchList<Todo>(`/todos${query ? `?${query}` : ''}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

export const useTodosByDate = (date: string) => useTodos({ date, limit: 200 });

export const useTodosOverdue = () => useTodos({ overdue: true, completed: false, limit: 200 });

export const useTodosToday = () => {
  const timezone = todoBrowserTimezone();
  return useTodos({ date: todoDateKey(new Date(), timezone), limit: 200, timezone });
};

// ============================================================================
// EFFICIENCY & ANALYTICS HOOKS
// ============================================================================

/**
 * Fetch daily efficiency report
 * 
 * OPTIMIZATION: Caches for 10 minutes since this is expensive to calculate
 */
export const useDailyEfficiency = (days: number = 1) => {
  return useQuery<Record<string, any>, Error>({
    queryKey: QUERY_KEYS.dailyEfficiency(days),
    queryFn: () => apiFetchJSON<Record<string, any>>(`/reports/efficiency?days=${days}`),
    staleTime: 10 * 60 * 1000, // 10 minutes - caching expensive calculations
    gcTime: 30 * 60 * 1000,    // 30 minutes
    refetchOnMount: false,
  });
};

/**
 * Fetch timer analytics
 */
export const useTimerAnalytics = (days: number, timezone: string) => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.timerAnalytics(days, timezone),
    queryFn: () =>
      apiFetchList<any>(`/timer/analytics?days=${days}&timezone=${encodeURIComponent(timezone)}`),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
};

/**
 * Fetch submitted daily reports (list, newest first, backend caps at 30)
 */
export const useReports = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.reports(),
    queryFn: () => apiFetchList<any>('/reports'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Submit a new daily report
 * Invalidates the reports list and efficiency (today + any cached trend windows)
 */
export const useCreateReport = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Partial<any>>({
    mutationFn: (reportData) =>
      apiFetchJSON<any>('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports() });
      queryClient.invalidateQueries({ queryKey: ['efficiency'] });
    },
  });
};

// ============================================================================
// NEWS HOOKS
// ============================================================================

/**
 * Fetch news for a specific exam type
 * 
 * OPTIMIZATION: Caches for 15 minutes since news updates infrequently
 */
export const useNews = (examType: string) => {
  return useQuery<any, Error>({
    queryKey: QUERY_KEYS.news(examType),
    queryFn: () => apiFetchJSON<any>(`/news/${examType}`),
    staleTime: 15 * 60 * 1000, // 15 minutes - news updates infrequently
    gcTime: 30 * 60 * 1000,    // 30 minutes
    refetchOnMount: false,
  });
};

/**
 * Fetch important dates for a specific exam type
 */
export const useNewsDates = (examType: string) => {
  return useQuery<any, Error>({
    queryKey: QUERY_KEYS.newsDates(examType),
    queryFn: () => apiFetchJSON<any>(`/news/${examType}/dates`),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
};

// ============================================================================
// PROFILE & USER HOOKS
// ============================================================================

/**
 * Fetch user profile
 */
export const useProfile = () => {
  return useQuery<User, Error>({
    queryKey: QUERY_KEYS.profile(),
    queryFn: () => apiFetchJSON<User>('/auth/me'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
};

/**
 * Update user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UpdateProfileInput>({
    mutationFn: (profileData) =>
      apiFetchJSON<User>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    }),
    onSuccess: (profile) => {
      queryClient.setQueryData(QUERY_KEYS.profile(), profile);
    },
  });
};

/**
 * Fetch leaderboard
 */
export const useLeaderboard = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.leaderboard(),
    queryFn: () => apiFetchList<any>('/users/leaderboard'),
    staleTime: 60 * 60 * 1000, // 1 hour - leaderboard updates rarely
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnMount: false,
    placeholderData: [],
  });
};

// ============================================================================
// NOTES HOOKS & MUTATIONS
// ============================================================================

/**
 * Fetch all notes
 */
export const useNotes = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.notes(),
    queryFn: () => apiFetchList<any>('/notes'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Create a new note
 */
export const useCreateNote = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Partial<any>>({
    mutationFn: (noteData) =>
      apiFetchJSON<any>('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes() });
    },
  });
};

/**
 * Update a note
 */
export const useUpdateNote = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; data: Partial<any> }>({
    mutationFn: ({ id, data }) =>
      apiFetchJSON<any>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.note(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes() });
    },
  });
};

/**
 * Delete a note
 */
export const useDeleteNote = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetchJSON<void>(`/notes/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.note(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes() });
    },
  });
};

// ============================================================================
// FRIENDS & MESSAGES HOOKS & MUTATIONS
// ============================================================================

/**
 * Fetch friends list
 */
export const useFriends = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.friends(),
    queryFn: () => apiFetchList<any>('/friends/list'),
    staleTime: 5 * 60 * 1000, // 5 minutes - keep friends reasonably fresh
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch friend requests
 */
export const useFriendRequests = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.friendRequests(),
    queryFn: () => apiFetchList<any>('/friends/requests'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch conversations
 */
export const useConversations = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.conversations(),
    queryFn: () => apiFetchList<any>('/messages/conversations'),
    staleTime: 60 * 1000, // 1 minute - messages should feel live
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch blocked users
 */
export const useBlockedUsers = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.blockedUsers(),
    queryFn: () => apiFetchList<any>('/friends/blocked'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Search users by query
 */
export const useSearchUsers = (query: string) => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.searchUsers(query),
    queryFn: () => apiFetchList<any>(`/friends/search?query=${encodeURIComponent(query)}`),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: query.trim().length >= 2,
    placeholderData: [],
  });
};

/**
 * Send a friend request
 */
export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { receiverId: string }>({
    mutationFn: ({ receiverId }) =>
      apiFetchJSON<any>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ receiverId }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests() });
    },
  });
};

/**
 * Accept a friend request
 */
export const useAcceptFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { requestId: string }>({
    mutationFn: ({ requestId }) =>
      apiFetchJSON<any>(`/friends/request/${requestId}/accept`, {
      method: 'PUT',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests() });
    },
  });
};

/**
 * Reject a friend request
 */
export const useRejectFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { requestId: string }>({
    mutationFn: ({ requestId }) =>
      apiFetchJSON<any>(`/friends/request/${requestId}/reject`, {
      method: 'PUT',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests() });
    },
  });
};

/**
 * Unfriend a user
 */
export const useUnfriend = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { friendshipId: string }>({
    mutationFn: ({ friendshipId }) =>
      apiFetchJSON<void>(`/friends/${friendshipId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends() });
    },
  });
};

/**
 * Block a user
 */
export const useBlockUser = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { userId: string }>({
    mutationFn: ({ userId }) =>
      apiFetchJSON<any>('/friends/block', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blockedUsers() });
    },
  });
};

/**
 * Unblock a user
 */
export const useUnblockUser = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { userId: string }>({
    mutationFn: ({ userId }) =>
      apiFetchJSON<void>(`/friends/block/${userId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blockedUsers() });
    },
  });
};

/**
 * Send a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { receiverId: string; message: string }>({
    mutationFn: ({ receiverId, message }) =>
      apiFetchJSON<any>('/messages', {
      method: 'POST',
      body: JSON.stringify({ receiverId, message }),
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.receiverId) });
    },
  });
};

/**
 * Fetch messages with a specific user
 */
export const useMessagesWithUser = (userId?: string) => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.messages(userId),
    queryFn: () => apiFetchList<any>(`/messages/${userId}`),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
    placeholderData: [],
  });
};

/**
 * Alias for useMessagesWithUser for backward compatibility
 */
export const useMessages = useMessagesWithUser;

// ============================================================================
// TODO MUTATIONS
// ============================================================================

const localDateKey = (value?: string | Date) => todoDateKey(value, todoBrowserTimezone());

const createOptimisticTodo = (input: CreateTodoInput, id: string): Todo => {
  const now = new Date().toISOString();
  const scheduledDate = input.scheduledDate || input.dueDate;
  return {
    id,
    title: input.title,
    subject: input.subject || 'General',
    difficulty: input.difficulty || 'medium',
    questionsTarget: input.questionsTarget || 10,
    completed: false,
    dueDate: input.dueDate || scheduledDate,
    scheduledDate: scheduledDate || input.dueDate,
    rescheduledCount: 0,
    createdAt: now,
    updatedAt: now,
    optimistic: true,
  };
};

const applyTodoPatch = (todo: Todo, data: UpdateTodoInput): Todo => ({
  ...todo,
  ...data,
  difficulty:
    data.difficulty === 'easy' || data.difficulty === 'medium' || data.difficulty === 'hard'
      ? data.difficulty
      : todo.difficulty,
  updatedAt: new Date().toISOString(),
});

/** Create a Todo and show it immediately only in matching cached lists. */
export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, CreateTodoInput, TodoMutationContext>({
    mutationFn: (todoData) =>
      apiFetchJSON<Todo>('/todos', {
      method: 'POST',
      body: JSON.stringify(todoData),
    }),
    onMutate: async (todoData) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const context = beginTodoMutation(queryClient, [{ id: optimisticId }]);
      context.optimisticId = optimisticId;
      putTodoInCachedLists(queryClient, createOptimisticTodo(todoData, optimisticId));
      return context;
    },
    onSuccess: (savedTodo, _variables, context) => {
      const entity = context.entities[0];
      if (isTodoMutationCurrent(queryClient, entity)) {
        removeTodoFromCachedLists(queryClient, context.optimisticId || entity.id);
        putTodoInCachedLists(queryClient, { ...savedTodo, optimistic: false });
      }
      queryClient.invalidateQueries({ queryKey: ['efficiency'] });
    },
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

/** Patch a Todo optimistically and re-evaluate every cached list filter. */
export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: string; data: UpdateTodoInput }, TodoMutationContext>({
    mutationFn: ({ id, data }) =>
      apiFetchJSON<unknown>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const previous = findCachedTodo(queryClient, id);
      const context = beginTodoMutation(queryClient, [{ id, previous }]);
      if (previous) putTodoInCachedLists(queryClient, applyTodoPatch(previous, data));
      return context;
    },
    onSuccess: (_result, variables, context) => {
      const entity = context.entities[0];
      if (isTodoMutationCurrent(queryClient, entity)) {
        const current = findCachedTodo(queryClient, variables.id);
        if (current) queryClient.setQueryData(QUERY_KEYS.todo(variables.id), current);
      }
      if ('completed' in variables.data)
        queryClient.invalidateQueries({ queryKey: ['efficiency'] });
    },
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, TodoMutationContext>({
    mutationFn: (id) => apiFetchJSON<void>(`/todos/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const context = beginTodoMutation(queryClient, [
        { id, previous: findCachedTodo(queryClient, id) },
      ]);
      removeTodoFromCachedLists(queryClient, id);
      return context;
    },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.todo(id), exact: true });
      queryClient.invalidateQueries({ queryKey: ['efficiency'] });
    },
    onError: (_error, _id, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useDeleteTodosByDay = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; count: number },
    Error,
    { date: Date },
    TodoMutationContext
  >({
    mutationFn: ({ date }) => {
      const dateStr = localDateKey(date);
      return apiFetchJSON<{ success: boolean; count: number }>(
        `/todos/by-day?date=${encodeURIComponent(dateStr)}`,
        { method: 'DELETE' }
      );
    },
    onMutate: async ({ date }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const target = localDateKey(date);
      const affected = findCachedTodos(
        queryClient,
        (todo) => localDateKey(todo.scheduledDate || todo.dueDate) === target
      );
      const context = beginTodoMutation(
        queryClient,
        affected.map((todo) => ({ id: todo.id, previous: todo }))
      );
      for (const todo of affected) removeTodoFromCachedLists(queryClient, todo.id);
      return context;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['efficiency'] }),
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useRescheduleTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Todo & { pointsCredited?: number },
    Error,
    { id: string; newDate: Date },
    TodoMutationContext
  >({
    mutationFn: ({ id, newDate }) =>
      apiFetchJSON<Todo & { pointsCredited?: number }>(`/todos/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ newDate }),
    }),
    onMutate: async ({ id, newDate }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const previous = findCachedTodo(queryClient, id);
      const context = beginTodoMutation(queryClient, [{ id, previous }]);
      if (previous) {
        const scheduledDate = newDate.toISOString();
        putTodoInCachedLists(queryClient, {
          ...previous,
          dueDate: scheduledDate,
          scheduledDate,
          rescheduledCount: (previous.rescheduledCount || 0) + 1,
        });
      }
      return context;
    },
    onSuccess: (savedTodo, _variables, context) => {
      if (isTodoMutationCurrent(queryClient, context.entities[0])) {
        putTodoInCachedLists(queryClient, savedTodo);
      }
    },
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useToggleTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: string; completed: boolean }, TodoMutationContext>({
    mutationFn: ({ id, completed }) =>
      apiFetchJSON<unknown>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const previous = findCachedTodo(queryClient, id);
      const context = beginTodoMutation(queryClient, [{ id, previous }]);
      if (previous) putTodoInCachedLists(queryClient, { ...previous, completed });
      return context;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['efficiency'] }),
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useRescheduleAllOverdue = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; count: number },
    Error,
    { targetDate?: Date },
    TodoMutationContext
  >({
    mutationFn: ({ targetDate }) =>
      apiFetchJSON<{ success: boolean; count: number }>('/todos/reschedule-all-overdue', {
      method: 'POST',
      body: JSON.stringify({ targetDate }),
    }),
    onMutate: async ({ targetDate }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const today = localDateKey(new Date());
      const affected = findCachedTodos(queryClient, (todo) => {
        const current = localDateKey(todo.scheduledDate || todo.dueDate);
        return !todo.completed && !!current && current < today;
      });
      const context = beginTodoMutation(
        queryClient,
        affected.map((todo) => ({ id: todo.id, previous: todo }))
      );
      const scheduledDate = (targetDate || new Date()).toISOString();
      for (const todo of affected) {
        putTodoInCachedLists(queryClient, {
          ...todo,
          dueDate: scheduledDate,
          scheduledDate,
          rescheduledCount: (todo.rescheduledCount || 0) + 1,
        });
      }
      return context;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['efficiency'] }),
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

export const useRescheduleTodoToToday = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; pointsCredited?: number },
    Error,
    { id: string },
    TodoMutationContext
  >({
    mutationFn: ({ id }) =>
      apiFetchJSON<{ success: boolean; pointsCredited?: number }>(
        `/todos/${id}/reschedule-to-today`,
        { method: 'POST' }
      ),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.todos() });
      const previous = findCachedTodo(queryClient, id);
      const context = beginTodoMutation(queryClient, [{ id, previous }]);
      if (previous) {
        const scheduledDate = new Date();
        scheduledDate.setHours(0, 0, 0, 0);
        putTodoInCachedLists(queryClient, {
          ...previous,
          dueDate: scheduledDate.toISOString(),
          scheduledDate: scheduledDate.toISOString(),
          rescheduledCount: (previous.rescheduledCount || 0) + 1,
        });
      }
      return context;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['efficiency'] }),
    onError: (_error, _variables, context) => rollbackTodoMutation(queryClient, context),
    onSettled: (_result, _error, _variables, context) => settleTodoMutation(queryClient, context),
  });
};

// ============================================================================
// SCHEDULE QUERIES (AI Smart Schedule)
// ============================================================================

export interface TimeBlock {
  dayOfWeek: number; // 0=Sun … 6=Sat
  startTime: string; // "08:00"
  endTime: string;   // "10:00"
  label?: string;
}

export interface Availability {
  id?: string;
  freeBlocks: TimeBlock[];
  blockedSlots: TimeBlock[];
  wakeTime?: string;
  sleepTime?: string;
}

export interface ScheduleItem {
  id: string;
  taskTitle: string;
  subject?: string;
  description?: string;
  startTime: string;
  endTime: string;
  date: string;
  priority?: 'low' | 'medium' | 'high';
  completed: boolean;
  alarmFired: boolean;
  pointsAwarded?: number;
}

export interface Schedule {
  id: string;
  userId: string;
  generatedAt: string;
  prompt: string;
  items: ScheduleItem[];
  date: string;
  createdAt: string;
  updatedAt: string;
}

// Extend QUERY_KEYS inline
export const SCHEDULE_QUERY_KEYS = {
  schedules: (date?: string) => ['schedules', date ?? 'all'] as const,
  availability: () => ['availability'] as const,
};

/**
 * Fetch user's availability config
 */
export const useAvailability = () => {
  return useQuery<Availability, Error>({
    queryKey: SCHEDULE_QUERY_KEYS.availability(),
    queryFn: () => apiFetchJSON<Availability>('/availability'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
};

/**
 * Save/update user's availability
 */
export const useUpsertAvailability = () => {
  const queryClient = useQueryClient();
  return useMutation<Availability, Error, Omit<Availability, 'id'>>({
    mutationFn: (data) =>
      apiFetchJSON<Availability>('/availability', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.availability() });
    },
  });
};

/**
 * Fetch schedules, optionally filtered by date (YYYY-MM-DD)
 */
export const useSchedules = (date?: string) => {
  return useQuery<Schedule[], Error>({
    queryKey: SCHEDULE_QUERY_KEYS.schedules(date),
    queryFn: () => apiFetchList<Schedule>(`/schedule${date ? `?date=${date}` : ''}`),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Generate a new AI schedule.
 *
 * The browser timezone is always sent so the backend can anchor a same-day plan
 * to the user's current local time instead of the server clock.
 */
export const useGenerateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation<Schedule, Error, { prompt: string; date?: string }>({
    mutationFn: ({ prompt, date }) =>
      apiFetchJSON<Schedule>('/schedule/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          date,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.schedules(data.date) });
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.schedules() });
    },
  });
};

/**
 * Delete a schedule
 */
export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetchJSON<void>(`/schedule/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Invalidate the ['schedules', ...] prefix so every date-keyed query
      // (e.g. ['schedules', '2026-07-11']) refetches — not just ['schedules', 'all'].
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
};

/**
 * Update a single item inside a schedule (mark complete, etc.)
 */
export const useUpdateScheduleItem = () => {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean; pointsAwarded: number },
    Error,
    { scheduleId: string; itemId: string; completed: boolean }
  >({
    mutationFn: ({ scheduleId, itemId, completed }) =>
      apiFetchJSON<{ success: boolean; pointsAwarded: number }>(
        `/schedule/${scheduleId}/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ completed }),
        }
      ),
    onSuccess: () => {
      // Prefix-invalidate so the currently viewed date's schedule refetches.
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      // Also refresh user stats so points update immediately in the nav/header
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userStats() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
    },
  });
};
