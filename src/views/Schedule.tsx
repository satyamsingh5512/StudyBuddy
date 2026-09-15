'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  Settings2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from '@/components/dashboard/glass';
import { staggerContainer, getRiseItem } from '@/lib/motion';
import { useToast } from '@/components/ui/use-toast';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { SkeletonList } from '@/components/Skeleton';
import {
  useAvailability,
  useSchedules,
  useDeleteSchedule,
  useUpdateScheduleItem,
  type Schedule,
  type ScheduleItem,
} from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import AvailabilitySetup from '@/components/AvailabilitySetup';
import AIScheduleGenerator from '@/components/AIScheduleGenerator';
import ScheduleTimeline from '@/components/ScheduleTimeline';
import ScheduleAlarmManager from '@/components/ScheduleAlarmManager';
import { QueryErrorState } from '@/components/QueryErrorState';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Local calendar date key. Using toISOString() here would roll the date back a
// day for timezones ahead of UTC during early-morning hours.
function toDateStr(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatDateLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface StatProps {
  label: string;
  value: string | number;
}
function Stat({ label, value }: StatProps) {
  return (
    <div className="min-w-0 flex-1 px-3 py-2 text-center sm:flex-none sm:px-5">
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────

export default function Schedule() {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const [user] = useAtom(userAtom);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [showGenerator, setShowGenerator] = useState(true);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const dateStr = toDateStr(selectedDate);

  // Queries
  const {
    data: availability,
    isLoading: availLoading,
    isError: availError,
    refetch: refetchAvailability,
  } = useAvailability();
  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    isError: schedulesError,
    refetch: refetchSchedules,
  } = useSchedules(dateStr);
  const deleteSchedule = useDeleteSchedule();
  const updateItem = useUpdateScheduleItem();

  // Today's schedules sorted by creation time (newest first = current attempt on top)
  const todaySchedules = useMemo(
    () => [...schedules].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [schedules]
  );

  const activeSchedule = todaySchedules[0] ?? null;

  // Derived stats for active schedule
  const stats = useMemo(() => {
    if (!activeSchedule) return { total: 0, done: 0, pending: 0, points: 0, pct: 0 };
    const total = activeSchedule.items.length;
    const done = activeSchedule.items.filter((i) => i.completed).length;
    const points = activeSchedule.items.reduce((acc, i) => acc + (i.pointsAwarded ?? 0), 0);
    return { total, done, pending: total - done, points, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [activeSchedule]);

  const handleToggleItem = useCallback(
    async (itemId: string, completed: boolean) => {
      if (!activeSchedule) return;
      try {
        const result = await updateItem.mutateAsync({
          scheduleId: activeSchedule.id,
          itemId,
          date: dateStr,
          completed,
        });
        if (completed && result.pointsAwarded > 0) {
          toast({
            title: `+${result.pointsAwarded} points`,
            description: 'Task marked as complete.',
          });
        }
      } catch {
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [activeSchedule, dateStr, updateItem, toast]
  );

  const handleRescheduleItem = useCallback(
    async (itemId: string, newStart: string, newEnd: string) => {
      if (!activeSchedule) return;
      const prev = queryClient.getQueryData<Schedule[]>(['schedules', dateStr]);
      // Optimistic move so the block lands instantly while the server saves.
      queryClient.setQueryData<Schedule[]>(['schedules', dateStr], (old = []) =>
        old.map((s) =>
          s.id !== activeSchedule.id
            ? s
            : {
                ...s,
                items: s.items.map((i: ScheduleItem) =>
                  i.id === itemId ? { ...i, startTime: newStart, endTime: newEnd } : i
                ),
              }
        )
      );
      setReschedulingId(itemId);
      try {
        const moved = activeSchedule.items.find((i) => i.id === itemId);
        await updateItem.mutateAsync({
          scheduleId: activeSchedule.id,
          itemId,
          date: dateStr,
          startTime: newStart,
          endTime: newEnd,
        });
        // Warn (but allow) when the new slot overlaps a sibling block.
        const toMin = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        const sMin = toMin(newStart);
        const eMin = toMin(newEnd);
        const overlaps = activeSchedule.items.some(
          (i) => i.id !== itemId && toMin(i.startTime) < eMin && toMin(i.endTime) > sMin
        );
        toast({
          title: moved ? `“${moved.taskTitle}” moved to ${newStart}–${newEnd}` : `Task moved to ${newStart}–${newEnd}`,
          description: overlaps ? 'Heads up: it now overlaps another block.' : 'Schedule updated.',
        });
      } catch {
        // Roll back to the server state on failure.
        if (prev) queryClient.setQueryData(['schedules', dateStr], prev);
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        toast({ title: 'Failed to move task', description: 'Please try again.', variant: 'destructive' });
      } finally {
        setReschedulingId(null);
      }
    },
    [activeSchedule, dateStr, queryClient, updateItem, toast]
  );

  const handleDeleteSchedule = useCallback(
    async (id: string) => {
      try {
        await deleteSchedule.mutateAsync(id);
        toast({ title: 'Schedule deleted.' });
      } catch {
        toast({ title: 'Failed to delete schedule', variant: 'destructive' });
      }
    },
    [deleteSchedule, toast]
  );

  const hasAvailability = !availLoading && (
    (availability?.freeBlocks?.length ?? 0) > 0 || !!availability?.wakeTime
  );

  // ── Loading skeleton ──
  if (schedulesLoading || availLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-4">
        <SkeletonList count={3} />
      </div>
    );
  }

  if (availError || schedulesError) {
    return (
      <div className="mx-auto max-w-5xl py-4">
        <QueryErrorState
          title="Could not load your schedule"
          description="Your schedule data could not be fetched. Nothing was changed; try again when the connection is ready."
          onRetry={() => Promise.all([refetchAvailability(), refetchSchedules()])}
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl space-y-4 py-2">
      {/* Alarm engine */}
      <ScheduleAlarmManager schedules={schedules} />

      {/* Availability modal */}
      <AvailabilitySetup
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        initialData={availability}
        onSaved={() => setAvailabilityOpen(false)}
      />

      {/* ── Page header ── */}
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        <motion.div variants={getRiseItem(reduce)} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Study schedule</h1>
              <p className="text-xs text-muted-foreground">
                {user?.name ? `Planned for ${user.name.split(' ')[0]} · ` : ''}Time-blocked plan with reminders
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setAvailabilityOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Availability
            </button>
            <button
              onClick={() => setShowGenerator((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {showGenerator ? 'Hide planner' : 'New plan'}
            </button>
          </div>
        </motion.div>

        {/* ── Availability nudge ── */}
        {!hasAvailability && !availLoading && (
          <motion.div variants={getRiseItem(reduce)}>
            <button
              onClick={() => setAvailabilityOpen(true)}
              className="flex w-full items-start gap-3 rounded-lg border border-border/60 border-l-2 border-l-amber-500 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <span className="block text-xs font-semibold">Set your availability</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Add your free hours so generated plans fit your real day. Takes under a minute.
                </span>
              </span>
            </button>
          </motion.div>
        )}

        {/* ── Date navigator ── */}
        <motion.div variants={getRiseItem(reduce)}>
          <GlassCard className="border-border/60">
            <GlassCardContent className="p-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  aria-label="Previous day"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="grid flex-1 grid-cols-3 gap-1 sm:grid-cols-5">
                  {[-2, -1, 0, 1, 2].map((offset) => {
                    const d = addDays(new Date(), offset);
                    const ds = toDateStr(d);
                    const isSelected = ds === dateStr;
                    return (
                      <button
                        key={ds}
                        onClick={() => setSelectedDate(d)}
                        className={`${Math.abs(offset) === 2 ? 'hidden sm:block' : 'block'} min-h-11 rounded-lg px-2 py-1.5 text-center transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span className="block text-[10px] font-medium uppercase tracking-wide opacity-80">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="block text-sm font-semibold tabular-nums leading-tight">{d.getDate()}</span>
                        {offset === 0 && (
                          <span className={`block text-[10px] font-medium ${isSelected ? 'opacity-80' : 'text-primary'}`}>
                            Today
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  aria-label="Next day"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* ── AI Generator ── */}
        <AnimatePresence>
          {showGenerator && (
            <motion.div
              key="generator"
              initial={reduce ? {} : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? {} : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <AIScheduleGenerator
                onGenerated={() => setShowGenerator(false)}
                selectedDate={dateStr}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active Schedule ── */}
        {activeSchedule ? (
          <motion.div variants={getRiseItem(reduce)} className="space-y-4">
            <GlassCard className="border-border/60">
              <GlassCardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{formatDateLabel(selectedDate)}&rsquo;s plan</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {activeSchedule.items.length} tasks · Generated{' '}
                      {new Date(activeSchedule.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSchedule(activeSchedule.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Delete schedule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>

                <div className="flex divide-x divide-border/50">
                  <Stat label="Total" value={stats.total} />
                  <Stat label="Done" value={stats.done} />
                  <Stat label="Pending" value={stats.pending} />
                  <Stat label="Points" value={`+${stats.points}`} />
                </div>

                {stats.total > 0 && (
                  <div className="border-t border-border/50 px-4 py-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{stats.done} of {stats.total} complete</span>
                      <span className="font-semibold tabular-nums">{stats.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.pct}%` }}
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                      />
                    </div>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Timeline */}
            <GlassCard className="border-border/60">
              <GlassCardHeader className="border-b border-border/50 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Day planner — drag &amp; drop
                </p>
              </GlassCardHeader>
              <GlassCardContent className="px-3 py-4">
                <ScheduleTimeline
                  items={activeSchedule.items}
                  onToggleItem={handleToggleItem}
                  onRescheduleItem={handleRescheduleItem}
                  reschedulingId={reschedulingId}
                />
              </GlassCardContent>
            </GlassCard>

            {/* Older schedules for today */}
            {todaySchedules.length > 1 && (
              <details className="group rounded-lg border border-border/60 bg-card">
                <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  {todaySchedules.length - 1} earlier version{todaySchedules.length - 1 > 1 ? 's' : ''} for {formatDateLabel(selectedDate)}
                </summary>
                <div className="space-y-1 border-t border-border/50 p-2">
                  {todaySchedules.slice(1).map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/60">
                      <div>
                        <p className="text-xs font-medium">{s.items.length} tasks</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(s.generatedAt).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete older schedule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        ) : (
          /* ── Empty state ── */
          <motion.div variants={getRiseItem(reduce)}>
            <GlassCard className="border-dashed">
              <GlassCardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No plan for {formatDateLabel(selectedDate)}</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Describe what you want to study and the AI will build a time-blocked plan for this day.
                  </p>
                </div>
                <button
                  onClick={() => setShowGenerator(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Create plan
                </button>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
