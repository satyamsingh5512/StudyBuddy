/**
 * Custom React Query Hooks for StudyBuddy
 * 
 * OPTIMIZATION: Centralized data fetching with automatic caching, deduplication,
 * background refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchJSON } from '@/config/api';

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
  timerAnalytics: (days: number, timezone: string) => ['timer', 'analytics', days, timezone] as const,
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
 * Fetch all todos for the current user
 * Caches for 5 minutes with automatic background refetching
 */
export const useTodos = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.todos(),
    queryFn: () => apiFetchJSON<any[]>(`/todos`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch todos for a specific date
 */
export const useTodosByDate = (date: string) => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.todosByDate(date),
    queryFn: () => apiFetchJSON<any[]>(`/todos`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch overdue todos
 */
export const useTodosOverdue = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.todosOverdue(),
    queryFn: () => apiFetchJSON<any[]>(`/todos?overdue=true`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
};

/**
 * Fetch today's todos
 */
export const useTodosToday = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.todosToday(),
    queryFn: () => apiFetchJSON<any[]>(`/todos`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: [],
  });
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
    queryFn: () => apiFetchJSON<any[]>(`/timer/analytics?days=${days}&timezone=${encodeURIComponent(timezone)}`),
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
    queryFn: () => apiFetchJSON<any[]>('/reports'),
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
    mutationFn: (reportData) => apiFetchJSON<any>('/reports', {
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
  return useQuery<any, Error>({
    queryKey: QUERY_KEYS.profile(),
    queryFn: () => apiFetchJSON<any>('/auth/me'),
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

  return useMutation<any, Error, Partial<any>>({
    mutationFn: (profileData) => apiFetchJSON<any>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
    },
  });
};

/**
 * Fetch leaderboard
 */
export const useLeaderboard = () => {
  return useQuery<any[], Error>({
    queryKey: QUERY_KEYS.leaderboard(),
    queryFn: () => apiFetchJSON<any[]>('/users/leaderboard'),
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
    queryFn: () => apiFetchJSON<any[]>('/notes'),
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
    mutationFn: (noteData) => apiFetchJSON<any>('/notes', {
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
    mutationFn: ({ id, data }) => apiFetchJSON<any>(`/notes/${id}`, {
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
    mutationFn: (id) => apiFetchJSON<void>(`/notes/${id}`, {
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
    queryFn: () => apiFetchJSON<any[]>('/friends/list'),
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
    queryFn: () => apiFetchJSON<any[]>('/friends/requests'),
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
    queryFn: () => apiFetchJSON<any[]>('/messages/conversations'),
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
    queryFn: () => apiFetchJSON<any[]>('/friends/blocked'),
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
    queryFn: () => apiFetchJSON<any[]>(`/friends/search?query=${encodeURIComponent(query)}`),
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
    mutationFn: ({ receiverId }) => apiFetchJSON<any>('/friends/request', {
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
    mutationFn: ({ requestId }) => apiFetchJSON<any>(`/friends/request/${requestId}/accept`, {
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
    mutationFn: ({ requestId }) => apiFetchJSON<any>(`/friends/request/${requestId}/reject`, {
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
    mutationFn: ({ friendshipId }) => apiFetchJSON<void>(`/friends/${friendshipId}`, {
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
    mutationFn: ({ userId }) => apiFetchJSON<any>('/friends/block', {
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
    mutationFn: ({ userId }) => apiFetchJSON<void>(`/friends/block/${userId}`, {
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
    mutationFn: ({ receiverId, message }) => apiFetchJSON<any>('/messages', {
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
    queryFn: () => apiFetchJSON<any[]>(`/messages/${userId}`),
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

/**
 * Create a new todo
 * Automatically invalidates todos cache to refetch
 */
export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Partial<any>>({
    mutationFn: (todoData) => apiFetchJSON<any>('/todos', {
      method: 'POST',
      body: JSON.stringify(todoData),
    }),
    onSuccess: () => {
      // Invalidates all todos queries for automatic refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
    },
  });
};

/**
 * Update an existing todo
 * Automatically invalidates affected queries
 */
export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; data: Partial<any> }>({
    mutationFn: ({ id, data }) => apiFetchJSON<any>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: (_, variables) => {
      // Invalidate both specific todo and todos list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todo(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
    },
  });
};

/**
 * Delete a todo
 * Automatically invalidates affected queries
 */
export const useDeleteTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetchJSON<void>(`/todos/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todo(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
    },
  });
};

/**
 * Reschedule a todo
 */
export const useRescheduleTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; newDate: Date }>({
    mutationFn: ({ id, newDate }) => apiFetchJSON<any>(`/todos/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ newDate }),
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todo(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todosByDate(variables.newDate.toISOString().split('T')[0]) });
    },
  });
};

/**
 * Mark todo as completed
 */
export const useToggleTodo = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; completed: boolean }>({
    mutationFn: ({ id, completed }) => apiFetchJSON<any>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyEfficiency(1) });
    },
  });
};

/**
 * Mark all overdue todos as completed
 */
export const useRescheduleAllOverdue = () => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; count: number }, Error, { targetDate?: Date }>({
    mutationFn: ({ targetDate }) => apiFetchJSON<{ success: boolean; count: number }>('/todos/reschedule-all-overdue', {
      method: 'POST',
      body: JSON.stringify({ targetDate }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyEfficiency(1) });
    },
  });
};

/**
 * Reschedule a todo to today (specific endpoint)
 */
export const useRescheduleTodoToToday = () => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; pointsCredited?: number }, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetchJSON<{ success: boolean; pointsCredited?: number }>(`/todos/${id}/reschedule-to-today`, {
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyEfficiency(1) });
    },
  });
};
