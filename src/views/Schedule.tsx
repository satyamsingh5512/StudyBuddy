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
  Star,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  AmbientBackground,
} from '@/components/dashboard/glass';
import { GlassButton } from '@/components/dashboard/glass/GlassButton';
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
import AvailabilitySetup from '@/components/AvailabilitySetup';
import AIScheduleGenerator from '@/components/AIScheduleGenerator';
import ScheduleTimeline from '@/components/ScheduleTimeline';
import ScheduleAlarmManager from '@/components/ScheduleAlarmManager';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
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

interface StatPillProps {
  label: string;
  value: string | number;
  color?: string;
}
function StatPill({ label, value, color = 'text-primary' }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-secondary/50 border border-border/30 min-w-16">
      <span className={`text-base font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
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

  const dateStr = toDateStr(selectedDate);

  // Queries
  const { data: availability, isLoading: availLoading } = useAvailability();
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules(dateStr);
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
    if (!activeSchedule) return { total: 0, done: 0, pending: 0, points: 0 };
    const total = activeSchedule.items.length;
    const done = activeSchedule.items.filter((i) => i.completed).length;
    const points = activeSchedule.items.reduce((acc, i) => acc + (i.pointsAwarded ?? 0), 0);
    return { total, done, pending: total - done, points };
  }, [activeSchedule]);

  const handleToggleItem = useCallback(
    async (itemId: string, completed: boolean) => {
      if (!activeSchedule) return;
      try {
        const result = await updateItem.mutateAsync({
          scheduleId: activeSchedule.id,
          itemId,
          completed,
        });
        if (completed && result.pointsAwarded > 0) {
          toast({
            title: `+${result.pointsAwarded} points! 🎉`,
            description: 'Task marked as complete.',
          });
        }
      } catch {
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [activeSchedule, updateItem, toast]
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
      <div className="max-w-4xl mx-auto space-y-6 py-4">
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="relative max-w-4xl mx-auto space-y-6 py-4">
      <AmbientBackground />

      {/* Alarm engine */}
      <ScheduleAlarmManager schedules={schedules} />

      {/* Availability modal */}
      <AvailabilitySetup
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        initialData={availability}
        onSaved={() => setAvailabilityOpen(false)}
      />

      {/* ── Page Header ── */}
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        <motion.div variants={getRiseItem(reduce)} className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <CalendarDays className="h-6 w-6 text-primary" />
              Smart Schedule
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated, time-blocked study plans with real-time alarms
            </p>
          </div>

          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => setAvailabilityOpen(true)}
              className="gap-1.5"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Availability</span>
            </GlassButton>
            <GlassButton
              size="sm"
              onClick={() => setShowGenerator((p) => !p)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">{showGenerator ? 'Hide' : 'Generate'}</span>
            </GlassButton>
          </div>
        </motion.div>

        {/* ── Availability nudge ── */}
        {!hasAvailability && !availLoading && (
          <motion.div variants={getRiseItem(reduce)}>
            <div
              className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer"
              onClick={() => setAvailabilityOpen(true)}
            >
              <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Set your availability first</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tell the AI when you're free so it can plan around your real schedule. Click to set up.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Date navigator ── */}
        <motion.div variants={getRiseItem(reduce)}>
          <GlassCard>
            <GlassCardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <GlassButton
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  className="h-9 w-9 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </GlassButton>

                <div className="flex gap-1.5 flex-wrap justify-center">
                  {[-2, -1, 0, 1, 2].map((offset) => {
                    const d = addDays(new Date(), offset);
                    const ds = toDateStr(d);
                    const isSelected = ds === dateStr;
                    return (
                      <button
                        key={ds}
                        onClick={() => setSelectedDate(d)}
                        className={`flex flex-col items-center px-3 py-2 rounded-xl text-sm transition-all duration-200 min-w-14 ${
                          isSelected
                            ? 'bg-primary/20 border border-primary/40 text-primary font-bold'
                            : 'bg-secondary/40 border border-transparent hover:border-border/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wide">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="text-base font-semibold">{d.getDate()}</span>
                        {offset === 0 && (
                          <span className="text-[9px] text-primary font-medium">Today</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <GlassButton
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  className="h-9 w-9 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </GlassButton>
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
            {/* Stats row */}
            <GlassCard>
              <GlassCardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{formatDateLabel(selectedDate)}'s Schedule</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generated {new Date(activeSchedule.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <StatPill label="Total" value={stats.total} />
                    <StatPill label="Done" value={stats.done} color="text-emerald-400" />
                    <StatPill label="Pending" value={stats.pending} color="text-amber-400" />
                    <StatPill label="Points" value={`+${stats.points}`} color="text-primary" />
                    <button
                      onClick={() => handleDeleteSchedule(activeSchedule.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
                      title="Delete schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Completion bar */}
                {stats.total > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.done / stats.total) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {Math.round((stats.done / stats.total) * 100)}% complete
                    </p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Timeline */}
            <GlassCard>
              <GlassCardHeader className="pb-2">
                <GlassCardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Time-Blocked Timeline
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="px-4 pb-6 overflow-x-auto">
                <ScheduleTimeline
                  items={activeSchedule.items}
                  onToggleItem={handleToggleItem}
                />
              </GlassCardContent>
            </GlassCard>

            {/* Older schedules for today */}
            {todaySchedules.length > 1 && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 select-none">
                  <ListChecks className="h-3.5 w-3.5" />
                  {todaySchedules.length - 1} older schedule(s) for {formatDateLabel(selectedDate)}
                </summary>
                <div className="mt-3 space-y-3">
                  {todaySchedules.slice(1).map((s) => (
                    <GlassCard key={s.id} className="opacity-70">
                      <GlassCardContent className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium">{s.items.length} tasks</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(s.generatedAt).toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </GlassCardContent>
                    </GlassCard>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        ) : (
          /* ── Empty state ── */
          <motion.div variants={getRiseItem(reduce)}>
            <GlassCard>
              <GlassCardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="p-5 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <CalendarDays className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">No schedule for {formatDateLabel(selectedDate)}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Use the AI generator above to create a personalized, time-blocked study plan in seconds.
                  </p>
                </div>
                <GlassButton
                  size="sm"
                  onClick={() => setShowGenerator(true)}
                  className="gap-1.5 bg-primary/80 hover:bg-primary text-white border-0"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Schedule
                </GlassButton>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
