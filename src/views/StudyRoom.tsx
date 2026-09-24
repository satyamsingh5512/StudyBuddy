'use client';

/**
 * Study Room detail — desks, chat, sessions, leaderboard.
 *
 * Realtime: exactly one long-poll for this room (useRoomRealtime) plus a 30s
 * presence heartbeat while the tab is visible. Nothing here opens a socket.
 *
 * Responsive contract: the tab strip scrolls horizontally *inside its own
 * container* (overflow-x-auto on the tablist only) so the page itself never
 * scrolls sideways on a 320px screen. Every list is paginated, and the chat log
 * is capped by its own scroll container rather than growing the page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  Clock,
  Crown,
  Loader2,
  LogOut,
  MessageSquare,
  Play,
  Send,
  Shield,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueryErrorState } from '@/components/QueryErrorState';
import { SkeletonList } from '@/components/Skeleton';
import { useToast } from '@/components/ui/use-toast';
import { getAvatarUrl } from '@/lib/avatar';
import { userAtom } from '@/store/atoms';
import { joinNativeStudyRoomFocus } from '@/lib/digitalDiscipline';
import {
  ROOM_REACTIONS,
  VISIBILITY_LABELS,
  categoryLabel,
  deskAccessibleLabel,
  flattenMessagePages,
  formatCountdown,
  formatFocusMinutes,
  presenceDotClass,
  presenceLabel,
  secondsUntil,
  useActiveRoomSession,
  useCompleteRoomSession,
  useCreateRoomSession,
  useDeleteRoomMessage,
  useJoinRoom,
  useJoinRoomSession,
  useLeaveRoom,
  useRoom,
  useRoomHeartbeat,
  useRoomLeaderboard,
  useRoomMembers,
  useRoomMessages,
  useRoomPresence,
  useRoomRealtime,
  useSendRoomMessage,
  useToggleRoomReaction,
  type PresenceState,
  type SessionMode,
  type SessionOutcome,
} from '@/lib/roomQueries';

type TabId = 'desks' | 'chat' | 'sessions' | 'leaderboard';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'desks', label: 'Desks', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

const PRESENCE_CHOICES: PresenceState[] = ['online', 'studying', 'deep_focus', 'break', 'away'];

function Avatar({ user, size = 32 }: { user: { username?: string; avatar?: string; avatarType?: string; name?: string }; size?: number }) {
  return (
    <Image
      src={getAvatarUrl(user)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full border border-hairline bg-surface-muted object-cover"
    />
  );
}

export default function StudyRoom({ roomId }: { roomId: string }) {
  const { toast } = useToast();
  const user = useAtomValue(userAtom);
  const [tab, setTab] = useState<TabId>('desks');
  const [presenceState, setPresenceState] = useState<PresenceState>('online');
  const [draft, setDraft] = useState('');
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [inviteCode, setInviteCode] = useState('');

  const room = useRoom(roomId);
  const isMember = room.data?.isMember ?? false;

  // Every member-only query is gated on membership so a non-member's room page
  // does not fire four requests that are guaranteed to 403.
  const presence = useRoomPresence(roomId, isMember);
  const members = useRoomMembers(roomId, isMember && tab === 'desks');
  const messages = useRoomMessages(roomId, isMember && tab === 'chat');
  const session = useActiveRoomSession(roomId, isMember);
  const leaderboard = useRoomLeaderboard(roomId, period, isMember && tab === 'leaderboard');

  useRoomRealtime(roomId, isMember);
  useRoomHeartbeat(roomId, presenceState, isMember);

  const joinRoom = useJoinRoom();
  const leaveRoom = useLeaveRoom();
  const sendMessage = useSendRoomMessage(roomId);
  const toggleReaction = useToggleRoomReaction(roomId);
  const deleteMessage = useDeleteRoomMessage(roomId);
  const createSession = useCreateRoomSession(roomId);
  const joinSession = useJoinRoomSession(roomId);
  const completeSession = useCompleteRoomSession(roomId);

  const chatMessages = useMemo(() => flattenMessagePages(messages.data?.pages), [messages.data]);
  const activeSession = session.data?.session ?? null;
  // Only a session the user explicitly joined is associated with native focus.
  // The room remains server-authoritative; this records local state and starts
  // elapsed-time calculation when the server state changes to active.
  const joinedNativeRoomSessionRef = useRef<string | null>(null);
  const startedNativeRoomSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !user?.id ||
      !activeSession ||
      activeSession.status !== 'active' ||
      joinedNativeRoomSessionRef.current !== activeSession.id ||
      startedNativeRoomSessionRef.current === activeSession.id
    ) return;
    startedNativeRoomSessionRef.current = activeSession.id;
    void joinNativeStudyRoomFocus(user.id, {
      roomId,
      serverSessionId: activeSession.id,
      startsAtMs: new Date(activeSession.startsAt).getTime(),
      durationMinutes: activeSession.plannedMinutes,
      topic: activeSession.topic,
    }).catch(() => undefined);
  }, [activeSession, roomId, user?.id]);

  // Countdown ticks locally from the server's startsAt/endsAt, so every member
  // sees the same clock without polling once per second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (tab !== 'chat' || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [tab, chatMessages.length]);

  if (room.isError) {
    return (
      <div className="mx-auto max-w-3xl pt-6">
        <QueryErrorState
          title="Could not load this room"
          description="It may be private, archived, or you may not have access."
          onRetry={room.refetch}
          retrying={room.isRefetching}
        />
      </div>
    );
  }

  if (room.isLoading || !room.data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 pt-6">
        <SkeletonList count={5} />
      </div>
    );
  }

  const data = room.data;

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync({ body });
      setDraft('');
    } catch (error) {
      toast({
        title: 'Message not sent',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleJoin = async () => {
    try {
      await joinRoom.mutateAsync({ roomId, inviteCode: inviteCode.trim() || undefined });
      toast({ title: 'Joined', description: `Welcome to ${data.name}.` });
    } catch (error) {
      toast({
        title: 'Could not join',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleHostSession = async (mode: SessionMode, minutes: number) => {
    try {
      await createSession.mutateAsync({ mode, plannedMinutes: minutes, startDelaySeconds: 60 });
      toast({ title: 'Session scheduled', description: 'Starting in one minute.' });
    } catch (error) {
      toast({
        title: 'Could not start a session',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleJoinSharedSession = async () => {
    if (!activeSession) return;
    try {
      await joinSession.mutateAsync({
        sessionId: activeSession.id,
        declaredMinutes: activeSession.plannedMinutes,
      });
      joinedNativeRoomSessionRef.current = activeSession.id;
      if (user?.id) {
        await joinNativeStudyRoomFocus(user.id, {
          roomId,
          serverSessionId: activeSession.id,
          startsAtMs: new Date(activeSession.startsAt).getTime(),
          durationMinutes: activeSession.plannedMinutes,
          topic: activeSession.topic,
        });
      }
      toast({ title: 'Joined shared focus', description: 'The room clock remains server-authoritative; your Android focus state is recorded locally.' });
    } catch (error) {
      toast({
        title: 'Could not join shared focus',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOutcome = async (outcome: SessionOutcome) => {
    if (!activeSession) return;
    const elapsed = Math.max(
      0,
      Math.floor((now - new Date(activeSession.startsAt).getTime()) / 60_000)
    );
    try {
      const result = await completeSession.mutateAsync({
        sessionId: activeSession.id,
        outcome,
        actualMinutes: Math.min(elapsed, activeSession.plannedMinutes),
      });
      toast({ title: 'Session recorded', description: `+${result.xpAwarded} XP` });
    } catch (error) {
      toast({
        title: 'Could not record the outcome',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-12">
      <div className="pt-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 pl-2">
          <Link href="/rooms">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All rooms
          </Link>
        </Button>
      </div>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-xl font-bold tracking-tight sm:text-2xl">
                {data.name}
              </h1>
              <Badge variant="outline" className="shrink-0">
                {VISIBILITY_LABELS[data.visibility]}
              </Badge>
              {data.viewerRole === 'owner' ? (
                <Badge className="shrink-0 gap-1">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  Owner
                </Badge>
              ) : data.viewerRole === 'moderator' ? (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Moderator
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {categoryLabel(data.category)} · {data.memberCount} members ·{' '}
              {formatFocusMinutes(data.totalStudyMinutes)} studied together
            </p>
            {data.description ? (
              <p className="mt-2 break-words text-sm text-muted-foreground">{data.description}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2">
            {isMember ? (
              data.viewerRole === 'owner' ? (
                <p className="max-w-[12rem] text-[11px] text-muted-foreground">
                  Transfer ownership before leaving this room.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  loading={leaveRoom.isPending}
                  loadingLabel="Leaving…"
                  onClick={() => void leaveRoom.mutateAsync(roomId)}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Leave
                </Button>
              )
            ) : (
              <>
                {data.visibility === 'private' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="room-invite-code" className="text-xs">
                      Invite code
                    </Label>
                    <Input
                      id="room-invite-code"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      className="h-10 w-full sm:w-44"
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={data.eligible === false}
                  loading={joinRoom.isPending}
                  loadingLabel="Joining…"
                  onClick={() => void handleJoin()}
                >
                  Join room
                </Button>
                {data.eligible === false ? (
                  <p className="max-w-[12rem] text-[11px] text-amber-600 dark:text-amber-400">
                    {data.ineligibleReasons?.join(', ')}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {data.goal ? (
          <div className="rounded-2xl border border-hairline bg-surface-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Room goal
            </p>
            <p className="mt-1 break-words text-sm text-ink">{data.goal.description}</p>
            {data.goal.targetDate ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Target {new Date(data.goal.targetDate).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {isMember && data.inviteCode ? (
          <p className="break-all text-xs text-muted-foreground">
            Invite code: <code className="font-mono">{data.inviteCode}</code>
          </p>
        ) : null}
      </Card>

      {!isMember ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold">Join to see desks, chat and sessions</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Room activity is visible to members only.
          </p>
        </Card>
      ) : (
        <>
          {activeSession ? (
            <Card className="space-y-3 p-4 sm:p-5" aria-live="polite">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {activeSession.status === 'scheduled' ? 'Starting soon' : 'Session in progress'}
                  </p>
                  <p className="mt-0.5 break-words text-sm font-medium text-ink">
                    {activeSession.topic || `${activeSession.plannedMinutes} minute focus`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.participantCount} joined · {activeSession.completedCount} completed
                  </p>
                </div>
                <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums">
                  {activeSession.status === 'scheduled'
                    ? formatCountdown(secondsUntil(activeSession.startsAt, now))
                    : formatCountdown(secondsUntil(activeSession.endsAt, now))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={joinSession.isPending}
                  loadingLabel="Joining…"
                  onClick={() => void handleJoinSharedSession()}
                >
                  Join session
                </Button>
                {/* Outcomes only once the clock is actually running: the API
                    rejects an outcome for a session that has not started. */}
                {activeSession.status === 'active' ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleOutcome('completed')}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Completed
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleOutcome('partial')}
                    >
                      Partially done
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleOutcome('missed')}
                    >
                      Not done
                    </Button>
                  </>
                ) : (
                  <p className="self-center text-xs text-muted-foreground">
                    Declare your goal now — you can report the outcome once the timer starts.
                  </p>
                )}
              </div>
            </Card>
          ) : null}

          <div className="space-y-4">
            <div
              role="tablist"
              aria-label="Room sections"
              className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
            >
              {TABS.map((item) => {
                const Icon = item.icon;
                const selected = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`room-tab-${item.id}`}
                    aria-selected={selected}
                    aria-controls={`room-panel-${item.id}`}
                    onClick={() => setTab(item.id)}
                    className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                      selected
                        ? 'bg-brand-subtle text-brand'
                        : 'text-muted-foreground hover:bg-ink/[0.04]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {tab === 'desks' ? (
              <div
                role="tabpanel"
                id="room-panel-desks"
                aria-labelledby="room-tab-desks"
                className="space-y-4"
              >
                <Card className="space-y-3 p-4">
                  <fieldset>
                    <legend className="text-sm font-medium">Your status</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PRESENCE_CHOICES.map((state) => (
                        <label
                          key={state}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-hairline px-3 text-sm transition-colors hover:bg-ink/[0.03] has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
                        >
                          <input
                            type="radio"
                            name="presence-state"
                            value={state}
                            checked={presenceState === state}
                            onChange={() => setPresenceState(state)}
                            className="h-4 w-4"
                          />
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${presenceDotClass(state)}`}
                            aria-hidden="true"
                          />
                          {presenceLabel(state)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="text-xs text-muted-foreground">
                    {presence.data?.liveCount ?? 0} at their desk ·{' '}
                    {presence.data?.studyingCount ?? 0} studying now
                  </p>
                </Card>

                {presence.isLoading ? (
                  <SkeletonList count={4} />
                ) : (presence.data?.desks.length ?? 0) === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-sm font-semibold">Nobody is at a desk yet</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                      Set your status to Studying and others will see you here.
                    </p>
                  </Card>
                ) : (
                  <ul
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label="Virtual study desks"
                  >
                    {(presence.data?.desks ?? []).map((desk) => (
                      <li key={desk.user?.id || desk.updatedAt} className="min-w-0">
                        <Card className="flex min-w-0 items-center gap-3 p-3">
                          <Avatar user={desk.user} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {desk.user?.name || desk.user?.username || 'Member'}
                            </p>
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${presenceDotClass(desk.state)}`}
                                aria-hidden="true"
                              />
                              <span className="truncate">{presenceLabel(desk.state)}</span>
                            </p>
                          </div>
                          {desk.state === 'studying' || desk.state === 'deep_focus' ? (
                            <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatFocusMinutes(desk.focusMinutes)}
                            </p>
                          ) : null}
                          <span className="sr-only">{deskAccessibleLabel(desk)}</span>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}

                <section aria-labelledby="members-heading" className="space-y-2">
                  <h2 id="members-heading" className="text-sm font-semibold">
                    Members
                  </h2>
                  {members.isLoading ? (
                    <SkeletonList count={3} />
                  ) : (
                    <Card className="divide-y divide-hairline p-0">
                      {(members.data?.members ?? []).map((member) => (
                        <div key={member.id} className="flex min-w-0 items-center gap-3 p-3">
                          <Avatar user={member.user} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">
                              {member.user?.name || member.user?.username}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Level {member.level} · {formatFocusMinutes(member.studyMinutes)}
                            </p>
                          </div>
                          {member.role !== 'member' ? (
                            <Badge variant="secondary" className="shrink-0 capitalize">
                              {member.role}
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </Card>
                  )}
                </section>
              </div>
            ) : null}

            {tab === 'chat' ? (
              <div role="tabpanel" id="room-panel-chat" aria-labelledby="room-tab-chat" className="space-y-3">
                {messages.hasNextPage ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void messages.fetchNextPage()}
                      loading={messages.isFetchingNextPage}
                      loadingLabel="Loading…"
                    >
                      Load earlier messages
                    </Button>
                  </div>
                ) : null}

                <Card className="p-0">
                  <div
                    ref={logRef}
                    role="log"
                    aria-label="Room chat"
                    aria-live="polite"
                    className="max-h-[55vh] space-y-3 overflow-y-auto p-3 sm:p-4"
                  >
                    {messages.isLoading ? (
                      <SkeletonList count={5} />
                    ) : chatMessages.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No messages yet. Say hello.
                      </p>
                    ) : (
                      chatMessages.map((message) => (
                        <article key={message.id} className="flex min-w-0 gap-2.5">
                          <Avatar user={message.user ?? {}} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 flex-wrap items-baseline gap-2">
                              <span className="truncate text-sm font-medium text-ink">
                                {message.user?.name || message.user?.username || 'Member'}
                              </span>
                              <time
                                dateTime={message.createdAt}
                                className="shrink-0 text-[11px] text-muted-foreground"
                              >
                                {new Date(message.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </time>
                              {message.pinned ? (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Pinned
                                </Badge>
                              ) : null}
                            </p>
                            {message.deleted ? (
                              <p className="text-sm italic text-muted-foreground">
                                This message was removed.
                              </p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm text-ink">
                                {message.body}
                              </p>
                            )}

                            {!message.deleted ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {message.reactions.map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    onClick={() =>
                                      void toggleReaction.mutateAsync({
                                        messageId: message.id,
                                        emoji: reaction.emoji,
                                      })
                                    }
                                    aria-label={`${reaction.emoji} ${reaction.count} reactions, toggle yours`}
                                    className="flex min-h-8 items-center gap-1 rounded-full border border-hairline px-2 text-xs transition-colors hover:bg-ink/[0.04]"
                                  >
                                    <span aria-hidden="true">{reaction.emoji}</span>
                                    <span className="tabular-nums">{reaction.count}</span>
                                  </button>
                                ))}
                                <details className="relative">
                                  <summary
                                    className="flex min-h-8 cursor-pointer list-none items-center rounded-full border border-hairline px-2 text-xs text-muted-foreground transition-colors hover:bg-ink/[0.04]"
                                    aria-label="Add a reaction"
                                  >
                                    +
                                  </summary>
                                  <div className="absolute z-10 mt-1 flex max-w-[16rem] flex-wrap gap-1 rounded-2xl border border-hairline bg-surface p-2">
                                    {ROOM_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        aria-label={`React with ${emoji}`}
                                        onClick={() =>
                                          void toggleReaction.mutateAsync({
                                            messageId: message.id,
                                            emoji,
                                          })
                                        }
                                        className="flex h-9 w-9 items-center justify-center rounded-xl text-base transition-colors hover:bg-ink/[0.05]"
                                      >
                                        <span aria-hidden="true">{emoji}</span>
                                      </button>
                                    ))}
                                  </div>
                                </details>
                                {data.canModerate ? (
                                  <button
                                    type="button"
                                    onClick={() => void deleteMessage.mutateAsync(message.id)}
                                    aria-label="Delete this message"
                                    className="flex min-h-8 items-center rounded-full border border-hairline px-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-hairline p-3">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="room-chat-input" className="sr-only">
                        Message this room
                      </Label>
                      <Input
                        id="room-chat-input"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Message the room"
                        maxLength={2000}
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Send message"
                      disabled={!draft.trim() || sendMessage.isPending}
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </form>
                </Card>
              </div>
            ) : null}

            {tab === 'sessions' ? (
              <div
                role="tabpanel"
                id="room-panel-sessions"
                aria-labelledby="room-tab-sessions"
                className="space-y-3"
              >
                <Card className="space-y-3 p-4">
                  <h2 className="text-sm font-semibold">Host a shared session</h2>
                  <p className="text-xs text-muted-foreground">
                    Everyone joins the same server-set clock, so the room starts and finishes
                    together.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={Boolean(activeSession) || createSession.isPending}
                      onClick={() => void handleHostSession('pomodoro', 25)}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Pomodoro 25m
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(activeSession) || createSession.isPending}
                      onClick={() => void handleHostSession('deep_work', 90)}
                    >
                      Deep work 90m
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(activeSession) || createSession.isPending}
                      onClick={() => void handleHostSession('custom', 50)}
                    >
                      Custom 50m
                    </Button>
                  </div>
                  {activeSession ? (
                    <p className="text-xs text-muted-foreground">
                      A session is already running in this room.
                    </p>
                  ) : null}
                </Card>

                {activeSession ? (
                  <Card className="space-y-2 p-4">
                    <h2 className="text-sm font-semibold">Who declared what</h2>
                    <ul className="divide-y divide-hairline">
                      {activeSession.participants.map((participant, index) => (
                        <li
                          key={participant.user?.id || index}
                          className="flex min-w-0 items-center gap-3 py-2"
                        >
                          <Avatar user={participant.user ?? {}} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">
                              {participant.user?.name || participant.user?.username || 'Member'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {participant.declaredGoal || participant.declaredTopic || 'Focus session'}{' '}
                              · {participant.declaredMinutes}m
                            </p>
                          </div>
                          {participant.outcome ? (
                            <Badge variant="secondary" className="shrink-0 capitalize">
                              {participant.outcome}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                      {activeSession.participants.length === 0 ? (
                        <li className="py-3 text-sm text-muted-foreground">
                          Nobody has joined this session yet.
                        </li>
                      ) : null}
                    </ul>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {tab === 'leaderboard' ? (
              <div
                role="tabpanel"
                id="room-panel-leaderboard"
                aria-labelledby="room-tab-leaderboard"
                className="space-y-3"
              >
                <div className="flex gap-2">
                  {(['daily', 'weekly'] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={period === value ? 'default' : 'outline'}
                      onClick={() => setPeriod(value)}
                      aria-pressed={period === value}
                      className="capitalize"
                    >
                      {value}
                    </Button>
                  ))}
                </div>

                {leaderboard.isLoading ? (
                  <SkeletonList count={5} />
                ) : (leaderboard.data?.entries.length ?? 0) === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-sm font-semibold">No results in this period yet</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                      Complete a shared session to appear on the board.
                    </p>
                  </Card>
                ) : (
                  <Card className="divide-y divide-hairline p-0">
                    {(leaderboard.data?.entries ?? []).map((entry) => (
                      <div key={entry.user?.id || entry.rank} className="flex min-w-0 items-center gap-3 p-3">
                        <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                          {entry.rank}
                        </span>
                        <Avatar user={entry.user} size={28} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">
                            {entry.user?.name || entry.user?.username}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatFocusMinutes(entry.focusMinutes)} · {entry.sessionsCompleted}{' '}
                            sessions
                            {typeof entry.productivityScore === 'number'
                              ? ` · score ${entry.productivityScore}`
                              : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Lv {entry.level}
                        </span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
