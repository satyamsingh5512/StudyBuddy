/**
 * Study Rooms data layer.
 *
 * Mirrors the conventions in src/lib/queries.ts: one QUERY_KEYS map, thin hooks
 * over apiFetchJSON, and mutations that invalidate by key prefix.
 *
 * Realtime: the backend exposes a per-room long-poll at /rooms/:id/changes that
 * carries invalidation topics only (never message bodies). useRoomRealtime opens
 * exactly one poll for the room the user currently has open — not for every room
 * they belong to — which is what keeps event traffic flat as membership grows.
 * When Redis is absent the endpoint reports {enabled:false} and the hooks fall
 * back to interval refetching, so rooms still work without Redis.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiFetch, apiFetchJSON } from '@/config/api';

export type RoomVisibility = 'public' | 'private' | 'goal' | 'elite';
export type RoomRole = 'owner' | 'moderator' | 'member' | '';
export type PresenceState = 'online' | 'studying' | 'deep_focus' | 'break' | 'away';
export type SessionMode = 'pomodoro' | 'custom' | 'deep_work';
export type SessionOutcome = 'completed' | 'partial' | 'missed';

export interface RoomUserSummary {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  avatarType?: string;
}

export interface RoomGoal {
  description: string;
  targetDate?: string;
  targetHours: number;
}

export interface RoomEntryRequirements {
  minStudyMinutes: number;
  minPoints: number;
  minStreak: number;
}

export interface StudyRoom {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  rules?: string;
  coverImageUrl?: string;
  visibility: RoomVisibility;
  ownerId: string;
  owner?: RoomUserSummary;
  goal?: RoomGoal | null;
  requirements?: RoomEntryRequirements | null;
  memberCount: number;
  totalStudyMinutes: number;
  sessionsHosted: number;
  messageCount: number;
  archived: boolean;
  lastActivityAt: string;
  createdAt: string;
  viewerRole: RoomRole;
  isMember: boolean;
  canModerate: boolean;
  canAdminister: boolean;
  eligible?: boolean;
  ineligibleReasons?: string[];
  inviteCode?: string;
  myStudyMinutes?: number;
  myXp?: number;
}

export interface RoomMemberEntry {
  id: string;
  user: RoomUserSummary;
  role: Exclude<RoomRole, ''>;
  studyMinutes: number;
  sessionsCompleted: number;
  xp: number;
  level: number;
  joinedAt: string;
}

export interface RoomDesk {
  user: RoomUserSummary;
  state: PresenceState;
  focusMinutes: number;
  sessionStartedAt?: string | null;
  updatedAt: string;
}

export interface RoomPresenceSnapshot {
  desks: RoomDesk[];
  liveCount: number;
  studyingCount: number;
  heartbeatSeconds: number;
}

export interface RoomReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface RoomMessage {
  id: string;
  body: string;
  deleted: boolean;
  pinned: boolean;
  mentions: string[];
  reactions: RoomReaction[];
  createdAt: string;
  userId: string;
  user?: RoomUserSummary;
  replyToId?: string;
}

export interface RoomSessionParticipant {
  user?: RoomUserSummary;
  declaredGoal?: string;
  declaredTopic?: string;
  declaredMinutes: number;
  outcome?: SessionOutcome | '';
  actualMinutes: number;
  xpAwarded: number;
}

export interface RoomSession {
  id: string;
  roomId: string;
  hostId: string;
  mode: SessionMode;
  topic?: string;
  plannedMinutes: number;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'active' | 'ended';
  participantCount: number;
  completedCount: number;
  participants: RoomSessionParticipant[];
}

export interface RoomLeaderboardEntry {
  rank: number;
  user: RoomUserSummary;
  focusMinutes: number;
  sessionsCompleted: number;
  xp: number;
  level: number;
  productivityScore?: number;
  activeDays?: number;
}

export interface RoomRanking {
  rank: number;
  id: string;
  name: string;
  slug: string;
  category: string;
  visibility: RoomVisibility;
  memberCount: number;
  totalStudyMinutes: number;
  minutesPerMember: number;
  sessionsHosted: number;
  lastActivityAt: string;
}

export interface RoomAchievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface RoomDiscoveryFilters {
  q?: string;
  category?: string;
  tag?: string;
  visibility?: Exclude<RoomVisibility, 'private'>;
  sort?: 'active' | 'members' | 'hours' | 'new';
}

export const ROOM_QUERY_KEYS = {
  all: () => ['rooms'] as const,
  discovery: (filters: RoomDiscoveryFilters) => ['rooms', 'discovery', filters] as const,
  mine: () => ['rooms', 'mine'] as const,
  detail: (roomId: string) => ['rooms', 'detail', roomId] as const,
  members: (roomId: string) => ['rooms', roomId, 'members'] as const,
  presence: (roomId: string) => ['rooms', roomId, 'presence'] as const,
  messages: (roomId: string) => ['rooms', roomId, 'messages'] as const,
  activeSession: (roomId: string) => ['rooms', roomId, 'session'] as const,
  leaderboard: (roomId: string, period: 'daily' | 'weekly') =>
    ['rooms', roomId, 'leaderboard', period] as const,
  rankings: () => ['rooms', 'rankings'] as const,
  achievements: () => ['rooms', 'achievements'] as const,
};

/** Presence heartbeat cadence. The server TTL is 90s, so 30s tolerates two losses. */
export const PRESENCE_HEARTBEAT_MS = 30_000;
/** Polling fallback used only when the realtime long-poll reports disabled. */
export const ROOM_POLL_FALLBACK_MS = 30_000;

const buildDiscoveryQuery = (filters: RoomDiscoveryFilters, cursor?: string): string => {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.visibility) params.set('visibility', filters.visibility);
  if (filters.sort && filters.sort !== 'active') params.set('sort', filters.sort);
  if (cursor) params.set('before', cursor);
  const query = params.toString();
  return query ? `/rooms?${query}` : '/rooms';
};

interface RoomPage {
  rooms: StudyRoom[];
  nextCursor: string;
}

/** Discovery list. Cursor pagination keeps deep pages as cheap as the first. */
export function useRoomDiscovery(filters: RoomDiscoveryFilters) {
  return useInfiniteQuery({
    queryKey: ROOM_QUERY_KEYS.discovery(filters),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      apiFetchJSON<RoomPage>(buildDiscoveryQuery(filters, pageParam as string)),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 30_000,
  });
}

export function useMyRooms() {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.mine(),
    queryFn: () => apiFetchJSON<{ rooms: StudyRoom[] }>('/rooms/mine'),
    staleTime: 30_000,
  });
}

export function useRoom(roomId: string, enabled = true) {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.detail(roomId),
    queryFn: () => apiFetchJSON<StudyRoom>(`/rooms/${roomId}`),
    enabled: enabled && Boolean(roomId),
  });
}

export function useRoomMembers(roomId: string, enabled = true) {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.members(roomId),
    queryFn: () =>
      apiFetchJSON<{ members: RoomMemberEntry[]; nextCursor: string }>(
        `/rooms/${roomId}/members?limit=50`
      ),
    enabled: enabled && Boolean(roomId),
  });
}

/**
 * Desks snapshot. refetchInterval is the no-Redis fallback; when realtime is
 * enabled the long-poll invalidates this key on state changes instead.
 */
export function useRoomPresence(roomId: string, enabled = true) {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.presence(roomId),
    queryFn: () => apiFetchJSON<RoomPresenceSnapshot>(`/rooms/${roomId}/presence`),
    enabled: enabled && Boolean(roomId),
    refetchInterval: ROOM_POLL_FALLBACK_MS,
  });
}

export function useRoomMessages(roomId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ROOM_QUERY_KEYS.messages(roomId),
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const suffix = pageParam ? `&before=${pageParam as string}` : '';
      return apiFetchJSON<{ messages: RoomMessage[]; nextCursor: string }>(
        `/rooms/${roomId}/messages?limit=50${suffix}`
      );
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: enabled && Boolean(roomId),
  });
}

export function useActiveRoomSession(roomId: string, enabled = true) {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.activeSession(roomId),
    queryFn: () => apiFetchJSON<{ session: RoomSession | null }>(`/rooms/${roomId}/sessions/active`),
    enabled: enabled && Boolean(roomId),
    refetchInterval: ROOM_POLL_FALLBACK_MS,
  });
}

export function useRoomLeaderboard(roomId: string, period: 'daily' | 'weekly', enabled = true) {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.leaderboard(roomId, period),
    queryFn: () =>
      apiFetchJSON<{ period: string; since: string; entries: RoomLeaderboardEntry[] }>(
        `/rooms/${roomId}/leaderboard?period=${period}`
      ),
    enabled: enabled && Boolean(roomId),
    staleTime: 60_000,
  });
}

export function useRoomRankings() {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.rankings(),
    queryFn: () => apiFetchJSON<{ rooms: RoomRanking[] }>('/rooms/leaderboard'),
    staleTime: 120_000,
  });
}

export function useRoomAchievements() {
  return useQuery({
    queryKey: ROOM_QUERY_KEYS.achievements(),
    queryFn: () =>
      apiFetchJSON<{
        achievements: RoomAchievement[];
        xp: number;
        level: number;
        nextLevelXp: number;
      }>('/rooms/achievements'),
    staleTime: 60_000,
  });
}

export interface CreateRoomInput {
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  rules?: string;
  coverImageUrl?: string;
  visibility: RoomVisibility;
  goal?: { description: string; targetDate: string; targetHours?: number } | null;
  requirements?: RoomEntryRequirements | null;
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) =>
      apiFetchJSON<StudyRoom>('/rooms', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.all() });
    },
  });
}

export function useJoinRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, inviteCode }: { roomId: string; inviteCode?: string }) =>
      apiFetchJSON<{ joined: boolean; role: RoomRole }>(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCode || '' }),
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(variables.roomId) });
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.mine() });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'discovery'] });
    },
  });
}

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) =>
      apiFetchJSON<{ left: boolean }>(`/rooms/${roomId}/leave`, { method: 'POST' }),
    onSuccess: (_data, roomId) => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(roomId) });
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.mine() });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'discovery'] });
    },
  });
}

export function useSendRoomMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; replyToId?: string; mentions?: string[] }) =>
      apiFetchJSON<RoomMessage>(`/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.messages(roomId) });
    },
  });
}

export function useToggleRoomReaction(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiFetchJSON<{ emoji: string; reacted: boolean }>(
        `/rooms/${roomId}/messages/${messageId}/reactions`,
        { method: 'POST', body: JSON.stringify({ emoji }) }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.messages(roomId) });
    },
  });
}

export function useDeleteRoomMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetchJSON<{ deleted: boolean }>(`/rooms/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.messages(roomId) });
    },
  });
}

export function useCreateRoomSession(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode: SessionMode;
      plannedMinutes: number;
      topic?: string;
      startDelaySeconds?: number;
    }) =>
      apiFetchJSON<RoomSession>(`/rooms/${roomId}/sessions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.activeSession(roomId) });
    },
  });
}

export function useJoinRoomSession(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      declaredGoal,
      declaredTopic,
      declaredMinutes,
    }: {
      sessionId: string;
      declaredGoal?: string;
      declaredTopic?: string;
      declaredMinutes?: number;
    }) =>
      apiFetchJSON<{ joined: boolean }>(`/rooms/${roomId}/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({ declaredGoal, declaredTopic, declaredMinutes }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.activeSession(roomId) });
    },
  });
}

export function useCompleteRoomSession(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      outcome,
      actualMinutes,
    }: {
      sessionId: string;
      outcome: SessionOutcome;
      actualMinutes: number;
    }) =>
      apiFetchJSON<{ outcome: SessionOutcome; actualMinutes: number; xpAwarded: number }>(
        `/rooms/${roomId}/sessions/${sessionId}/complete`,
        { method: 'POST', body: JSON.stringify({ outcome, actualMinutes }) }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.activeSession(roomId) });
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(roomId) });
      void queryClient.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.achievements() });
    },
  });
}

/**
 * Presence heartbeat. Failures are swallowed on purpose: a dropped heartbeat
 * expires the desk server-side within the TTL, which is the correct outcome, and
 * surfacing an error toast for it would be noise during a focus session.
 *
 * A state change sends immediately rather than waiting for the next tick, and
 * the focus clock restarts on entering a focus state — otherwise time spent
 * merely "online" would be reported as study time.
 */
export function useRoomHeartbeat(roomId: string, state: PresenceState, enabled: boolean) {
  const focusStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const isFocusState = state === 'studying' || state === 'deep_focus';
    if (isFocusState) {
      if (focusStartedAtRef.current === null) focusStartedAtRef.current = Date.now();
    } else {
      focusStartedAtRef.current = null;
    }

    let cancelled = false;
    const send = async () => {
      const startedAt = focusStartedAtRef.current;
      const focusMinutes =
        isFocusState && startedAt !== null ? Math.floor((Date.now() - startedAt) / 60_000) : 0;
      try {
        await apiFetchJSON(`/rooms/${roomId}/presence`, {
          method: 'POST',
          body: JSON.stringify({ state, focusMinutes }),
        });
      } catch {
        /* Presence is best-effort; the server TTL removes a stale desk. */
      }
    };

    // Send at once so a state change is visible to the room immediately, then
    // keep the desk alive on the interval.
    void send();
    const timer = window.setInterval(() => {
      if (!cancelled) void send();
    }, PRESENCE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [roomId, enabled, state]);
}

/** Maps a room realtime topic onto the query keys it invalidates. */
export function invalidateForRoomTopic(
  queryClient: QueryClient,
  roomId: string,
  topic: string
): void {
  switch (topic) {
    case 'room:chat':
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.messages(roomId) });
      break;
    case 'room:presence':
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.presence(roomId) });
      break;
    case 'room:session':
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.activeSession(roomId) });
      void queryClient.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] });
      break;
    case 'room:members':
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.members(roomId) });
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(roomId) });
      break;
    case 'room:updated':
    case 'room:archived':
      void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(roomId) });
      break;
    default:
      // Unknown topics are ignored: no payload from the stream is ever trusted.
      break;
  }
}

/**
 * One long-poll for the open room. Returns nothing; it only invalidates queries.
 * The loop exits on unmount and never runs for more than one room at a time,
 * which is what bounds realtime cost per user regardless of how many rooms they
 * have joined.
 */
export function useRoomRealtime(roomId: string, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !roomId || typeof window === 'undefined') return;

    let stopped = false;
    let controller: AbortController | null = null;
    let cursor = '';

    const loop = async () => {
      while (!stopped) {
        if (!navigator.onLine) {
          await new Promise((resolve) => window.setTimeout(resolve, 5_000));
          continue;
        }
        controller = new AbortController();
        try {
          const params = new URLSearchParams({ timeout: '25' });
          if (cursor) params.set('cursor', cursor);
          const response = await apiFetch(`/rooms/${roomId}/changes?${params}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            // 401/403/404 mean this client must stop polling this room.
            if (response.status === 401 || response.status === 403 || response.status === 404) return;
            await new Promise((resolve) => window.setTimeout(resolve, 5_000));
            continue;
          }
          const changes = (await response.json()) as {
            enabled: boolean;
            events: { id: string; topic: string }[];
            cursor: string;
          };
          if (changes.cursor) cursor = changes.cursor;
          for (const event of Array.isArray(changes.events) ? changes.events : []) {
            invalidateForRoomTopic(queryClient, roomId, event.topic);
          }
          if (!changes.enabled) {
            // No Redis: stop long-polling and let refetchInterval take over.
            return;
          }
        } catch (error) {
          if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
          await new Promise((resolve) => window.setTimeout(resolve, 5_000));
        } finally {
          controller = null;
        }
      }
    };

    void loop();
    return () => {
      stopped = true;
      controller?.abort();
    };
  }, [roomId, enabled, queryClient]);
}

/** Stable callback for refreshing everything about one room. */
export function useRefreshRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['rooms', roomId] });
    void queryClient.invalidateQueries({ queryKey: ROOM_QUERY_KEYS.detail(roomId) });
  }, [queryClient, roomId]);
}

// ---------------------------------------------------------------------------
// Pure presentation helpers. Exported for unit testing: these are the functions
// that decide what a user reads on a desk, so they must be covered.
// ---------------------------------------------------------------------------

export const PRESENCE_LABELS: Record<PresenceState, string> = {
  online: 'Online',
  studying: 'Studying',
  deep_focus: 'Deep focus',
  break: 'On a break',
  away: 'Away',
};

/**
 * Presence is never communicated by colour alone: every desk renders this label
 * next to its dot so the state is available to screen readers and to users who
 * cannot distinguish the dot colours.
 */
export function presenceLabel(state: PresenceState | string): string {
  return PRESENCE_LABELS[state as PresenceState] ?? 'Online';
}

/** Tailwind dot colour per state. Decorative only; the label carries meaning. */
export function presenceDotClass(state: PresenceState | string): string {
  switch (state) {
    case 'deep_focus':
      return 'bg-violet-500';
    case 'studying':
      return 'bg-emerald-500';
    case 'break':
      return 'bg-amber-500';
    case 'away':
      return 'bg-slate-400';
    default:
      return 'bg-sky-500';
  }
}

/** "1h 25m" / "45m" / "0m". Used for both desks and leaderboard rows. */
export function formatFocusMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

/** Accessible one-line description of a desk, e.g. "Aditi, deep focus, 42m". */
export function deskAccessibleLabel(desk: RoomDesk): string {
  const name = desk.user?.name || desk.user?.username || 'Member';
  const label = presenceLabel(desk.state).toLowerCase();
  if (desk.state === 'studying' || desk.state === 'deep_focus') {
    return `${name}, ${label}, ${formatFocusMinutes(desk.focusMinutes)}`;
  }
  return `${name}, ${label}`;
}

/** Remaining whole seconds until an ISO timestamp, floored at zero. */
export function secondsUntil(iso: string, now: number = Date.now()): number {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.floor((target - now) / 1000));
}

/** "mm:ss", or "h:mm:ss" past an hour. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Flattens infinite-query pages into one chronological message list. */
export function flattenMessagePages(
  pages: { messages: RoomMessage[] }[] | undefined
): RoomMessage[] {
  if (!Array.isArray(pages)) return [];
  // Pages arrive newest-batch-last from the cursor walk, and each page is
  // already chronological, so older pages must be prepended.
  const ordered: RoomMessage[] = [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    if (page && Array.isArray(page.messages)) ordered.push(...page.messages);
  }
  const seen = new Set<string>();
  return ordered.filter((message) => {
    if (!message || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

/** Flattens discovery pages, de-duplicating rooms across page boundaries. */
export function flattenRoomPages(pages: RoomPage[] | undefined): StudyRoom[] {
  if (!Array.isArray(pages)) return [];
  const seen = new Set<string>();
  const rooms: StudyRoom[] = [];
  for (const page of pages) {
    for (const room of Array.isArray(page?.rooms) ? page.rooms : []) {
      if (!room || seen.has(room.id)) continue;
      seen.add(room.id);
      rooms.push(room);
    }
  }
  return rooms;
}

export const ROOM_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'competitive-exam', label: 'Competitive exam' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'medical', label: 'Medical' },
  { value: 'programming', label: 'Programming' },
  { value: 'school', label: 'School' },
  { value: 'language', label: 'Language' },
  { value: 'university', label: 'University' },
  { value: 'general', label: 'General' },
];

export const ROOM_REACTIONS = ['👍', '🔥', '🎯', '💪', '🧠', '👏', '😅', '❤️'];

export function categoryLabel(value: string): string {
  return ROOM_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? 'General';
}

export const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  public: 'Public',
  private: 'Private',
  goal: 'Goal-based',
  elite: 'Elite',
};
