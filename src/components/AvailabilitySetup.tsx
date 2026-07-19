'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, Plus, Trash2, Check, Sunrise, Moon, Copy, AlertCircle } from 'lucide-react';
import { GlassModal } from '@/components/dashboard/glass/GlassModal';
import { useToast } from '@/components/ui/use-toast';
import { useUpsertAvailability, type TimeBlock, type Availability } from '@/lib/queries';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DAYS = [
  { short: 'Sun', full: 'Sunday',    i: 0 },
  { short: 'Mon', full: 'Monday',    i: 1 },
  { short: 'Tue', full: 'Tuesday',   i: 2 },
  { short: 'Wed', full: 'Wednesday', i: 3 },
  { short: 'Thu', full: 'Thursday',  i: 4 },
  { short: 'Fri', full: 'Friday',    i: 5 },
  { short: 'Sat', full: 'Saturday',  i: 6 },
];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  label?: string;  // only for blocked
}

// DaySchedule holds free + blocked slots per day
interface DaySchedule {
  free: Slot[];
  blocked: Slot[];
}

type WeekSchedule = Record<number, DaySchedule>; // key = 0..6

// ─────────────────────────────────────────────
// ID helper
// ─────────────────────────────────────────────

let _id = 0;
const uid = () => `s_${Date.now()}_${++_id}`;

// ─────────────────────────────────────────────
// Conversion helpers
// ─────────────────────────────────────────────

function blocksToWeek(freeBlocks: TimeBlock[], blockedSlots: TimeBlock[]): WeekSchedule {
  const week: WeekSchedule = {};
  for (let d = 0; d < 7; d++) {
    week[d] = { free: [], blocked: [] };
  }
  for (const b of freeBlocks) {
    week[b.dayOfWeek]?.free.push({ id: uid(), startTime: b.startTime, endTime: b.endTime });
  }
  for (const b of blockedSlots) {
    week[b.dayOfWeek]?.blocked.push({ id: uid(), startTime: b.startTime, endTime: b.endTime, label: b.label });
  }
  return week;
}

function weekToBlocks(week: WeekSchedule): { freeBlocks: TimeBlock[]; blockedSlots: TimeBlock[] } {
  const freeBlocks: TimeBlock[] = [];
  const blockedSlots: TimeBlock[] = [];
  for (let d = 0; d < 7; d++) {
    for (const s of week[d]?.free ?? []) {
      freeBlocks.push({ dayOfWeek: d, startTime: s.startTime, endTime: s.endTime });
    }
    for (const s of week[d]?.blocked ?? []) {
      blockedSlots.push({ dayOfWeek: d, startTime: s.startTime, endTime: s.endTime, label: s.label });
    }
  }
  return { freeBlocks, blockedSlots };
}

function emptyWeek(): WeekSchedule {
  const w: WeekSchedule = {};
  for (let d = 0; d < 7; d++) w[d] = { free: [], blocked: [] };
  return w;
}

// ─────────────────────────────────────────────
// SlotRow — a single time slot inside a day
// ─────────────────────────────────────────────

interface SlotRowProps {
  slot: Slot;
  type: 'free' | 'blocked';
  onChange: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  onApplyAll: (slot: Slot) => void;
}

function SlotRow({ slot, type, onChange, onRemove, onApplyAll }: SlotRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className={cn(
        'flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border mb-2',
        type === 'free'
          ? 'bg-emerald-500/8 border-emerald-500/20'
          : 'bg-rose-500/8 border-rose-500/20'
      )}>
        {/* Time pickers */}
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            value={slot.startTime}
            onChange={(e) => onChange(slot.id, 'startTime', e.target.value)}
            className="bg-background border border-border/60 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-28"
          />
          <span className="text-[11px] text-muted-foreground">to</span>
          <input
            type="time"
            value={slot.endTime}
            onChange={(e) => onChange(slot.id, 'endTime', e.target.value)}
            className="bg-background border border-border/60 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-28"
          />
        </div>

        {/* Label for blocked only */}
        {type === 'blocked' && (
          <input
            placeholder="e.g. College, Lunch"
            value={slot.label ?? ''}
            onChange={(e) => onChange(slot.id, 'label', e.target.value)}
            className="flex-1 min-w-24 bg-background border border-border/60 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* Apply to all week */}
          <button
            onClick={() => onApplyAll(slot)}
            title="Copy this time slot to all 7 days"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
          >
            <Copy className="h-3 w-3" />
            <span className="hidden sm:inline">All week</span>
          </button>
          {/* Remove */}
          <button
            onClick={() => onRemove(slot.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// DayPanel — one collapsible day row
// ─────────────────────────────────────────────

interface DayPanelProps {
  dayIndex: number;
  dayFull: string;
  dayShort: string;
  schedule: DaySchedule;
  onAddFree: (day: number) => void;
  onAddBlocked: (day: number) => void;
  onChangeSlot: (day: number, type: 'free' | 'blocked', id: string, field: string, value: string) => void;
  onRemoveSlot: (day: number, type: 'free' | 'blocked', id: string) => void;
  onApplyAll: (day: number, type: 'free' | 'blocked', slot: Slot) => void;
}

function DayPanel({ dayIndex, dayFull, dayShort, schedule, onAddFree, onAddBlocked, onChangeSlot, onRemoveSlot, onApplyAll }: DayPanelProps) {
  const [open, setOpen] = useState(dayIndex >= 1 && dayIndex <= 5); // Mon–Fri open by default
  const totalSlots = schedule.free.length + schedule.blocked.length;

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden">
      {/* Day header — click to expand */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {dayShort}
          </span>
          <span className="text-sm font-semibold">{dayFull}</span>
          {totalSlots > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {schedule.free.length > 0 && (
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                  {schedule.free.length} free
                </span>
              )}
              {schedule.blocked.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 inline-block" />
                  {schedule.blocked.length} blocked
                </span>
              )}
            </span>
          )}
        </div>
        <span className={cn('text-muted-foreground text-sm transition-transform duration-200', open && 'rotate-180')}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Free windows */}
              <div>
                <p className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                  Free / Study Windows
                </p>
                <AnimatePresence>
                  {schedule.free.map(s => (
                    <SlotRow
                      key={s.id}
                      slot={s}
                      type="free"
                      onChange={(id, field, val) => onChangeSlot(dayIndex, 'free', id, field, val)}
                      onRemove={(id) => onRemoveSlot(dayIndex, 'free', id)}
                      onApplyAll={(slot) => onApplyAll(dayIndex, 'free', slot)}
                    />
                  ))}
                </AnimatePresence>
                <button
                  onClick={() => onAddFree(dayIndex)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium border border-dashed border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 transition-all duration-150"
                >
                  <Plus className="h-3.5 w-3.5" /> Add free window
                </button>
              </div>

              {/* Blocked slots */}
              <div>
                <p className="text-xs font-semibold text-rose-500 mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 inline-block" />
                  Blocked / Busy Time
                </p>
                <AnimatePresence>
                  {schedule.blocked.map(s => (
                    <SlotRow
                      key={s.id}
                      slot={s}
                      type="blocked"
                      onChange={(id, field, val) => onChangeSlot(dayIndex, 'blocked', id, field, val)}
                      onRemove={(id) => onRemoveSlot(dayIndex, 'blocked', id)}
                      onApplyAll={(slot) => onApplyAll(dayIndex, 'blocked', slot)}
                    />
                  ))}
                </AnimatePresence>
                <button
                  onClick={() => onAddBlocked(dayIndex)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium border border-dashed border-rose-500/40 text-rose-500 hover:bg-rose-500/10 transition-all duration-150"
                >
                  <Plus className="h-3.5 w-3.5" /> Add blocked slot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main AvailabilitySetup
// ─────────────────────────────────────────────

interface AvailabilitySetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Availability;
  onSaved?: () => void;
}

export default function AvailabilitySetup({ open, onOpenChange, initialData, onSaved }: AvailabilitySetupProps) {
  const { toast } = useToast();
  const upsert = useUpsertAvailability();

  const [wakeTime, setWakeTime] = useState(initialData?.wakeTime ?? '06:00');
  const [sleepTime, setSleepTime] = useState(initialData?.sleepTime ?? '23:00');
  const [week, setWeek] = useState<WeekSchedule>(() =>
    initialData?.freeBlocks || initialData?.blockedSlots
      ? blocksToWeek(initialData.freeBlocks ?? [], initialData.blockedSlots ?? [])
      : emptyWeek()
  );

  // Reset state when initialData changes (modal re-opened with fresh data)
  const resetToInitial = useCallback(() => {
    setWakeTime(initialData?.wakeTime ?? '06:00');
    setSleepTime(initialData?.sleepTime ?? '23:00');
    setWeek(
      initialData?.freeBlocks || initialData?.blockedSlots
        ? blocksToWeek(initialData.freeBlocks ?? [], initialData.blockedSlots ?? [])
        : emptyWeek()
    );
  }, [initialData]);

  // ── Slot operations ──

  const addSlot = (day: number, type: 'free' | 'blocked') => {
    setWeek(w => {
      const copy = { ...w, [day]: { ...w[day] } };
      if (type === 'free') {
        copy[day] = { ...copy[day], free: [...copy[day].free, { id: uid(), startTime: '09:00', endTime: '11:00' }] };
      } else {
        copy[day] = { ...copy[day], blocked: [...copy[day].blocked, { id: uid(), startTime: '13:00', endTime: '14:00', label: '' }] };
      }
      return copy;
    });
  };

  const removeSlot = (day: number, type: 'free' | 'blocked', id: string) => {
    setWeek(w => {
      const copy = { ...w, [day]: { ...w[day] } };
      if (type === 'free') {
        copy[day] = { ...copy[day], free: copy[day].free.filter(s => s.id !== id) };
      } else {
        copy[day] = { ...copy[day], blocked: copy[day].blocked.filter(s => s.id !== id) };
      }
      return copy;
    });
  };

  const changeSlot = (day: number, type: 'free' | 'blocked', id: string, field: string, value: string) => {
    setWeek(w => {
      const copy = { ...w, [day]: { ...w[day] } };
      if (type === 'free') {
        copy[day] = { ...copy[day], free: copy[day].free.map(s => s.id === id ? { ...s, [field]: value } : s) };
      } else {
        copy[day] = { ...copy[day], blocked: copy[day].blocked.map(s => s.id === id ? { ...s, [field]: value } : s) };
      }
      return copy;
    });
  };

  // "Apply to all week" — copies this slot's times to every day (as a new slot)
  const applyToAllDays = (sourceDayIndex: number, type: 'free' | 'blocked', slot: Slot) => {
    setWeek(w => {
      const next = { ...w };
      for (let d = 0; d < 7; d++) {
        if (d === sourceDayIndex) continue; // skip source day itself
        const newSlot: Slot = { id: uid(), startTime: slot.startTime, endTime: slot.endTime, label: slot.label };
        if (type === 'free') {
          // Don't duplicate if same time already exists
          const alreadyExists = next[d].free.some(s => s.startTime === slot.startTime && s.endTime === slot.endTime);
          if (!alreadyExists) {
            next[d] = { ...next[d], free: [...next[d].free, newSlot] };
          }
        } else {
          const alreadyExists = next[d].blocked.some(s => s.startTime === slot.startTime && s.endTime === slot.endTime);
          if (!alreadyExists) {
            next[d] = { ...next[d], blocked: [...next[d].blocked, newSlot] };
          }
        }
      }
      return next;
    });
    toast({ title: '📋 Applied to all 7 days', description: `${slot.startTime}–${slot.endTime} copied to the whole week.` });
  };

  // Clear entire week
  const clearAll = () => {
    setWeek(emptyWeek());
    toast({ title: 'Week cleared' });
  };

  const handleSave = async () => {
    const { freeBlocks, blockedSlots } = weekToBlocks(week);
    try {
      await upsert.mutateAsync({ freeBlocks, blockedSlots, wakeTime, sleepTime });
      toast({ title: '✅ Availability saved!', description: 'The AI will now plan around your schedule.' });
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const totalFree = Object.values(week).reduce((n, d) => n + d.free.length, 0);
  const totalBlocked = Object.values(week).reduce((n, d) => n + d.blocked.length, 0);

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Set up your weekly availability"
      className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/40 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Weekly Availability</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set free/blocked times per day — AI schedules only within free windows
              </p>
            </div>
          </div>
          <button
            onClick={resetToInitial}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 mt-1"
          >
            Reset
          </button>
        </div>

        {/* Wake / Sleep */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            <Sunrise className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Wake up</p>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
            <Moon className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Sleep</p>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary pills */}
        {(totalFree > 0 || totalBlocked > 0) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {totalFree > 0 && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                {totalFree} free slot{totalFree > 1 ? 's' : ''}
              </span>
            )}
            {totalBlocked > 0 && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 font-medium">
                {totalBlocked} blocked slot{totalBlocked > 1 ? 's' : ''}
              </span>
            )}
            <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors ml-auto">
              Clear all
            </button>
          </div>
        )}

        {/* Tip */}
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
          <AlertCircle className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click <strong className="text-foreground">All week</strong> on any slot to copy that time to every day of the week instantly.
          </p>
        </div>
      </div>

      {/* Day list — scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {DAYS.map(({ short, full, i }) => (
          <DayPanel
            key={i}
            dayIndex={i}
            dayFull={full}
            dayShort={short}
            schedule={week[i]}
            onAddFree={(day) => addSlot(day, 'free')}
            onAddBlocked={(day) => addSlot(day, 'blocked')}
            onChangeSlot={changeSlot}
            onRemoveSlot={removeSlot}
            onApplyAll={applyToAllDays}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 flex-col-reverse gap-3 border-t border-border/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <button
          onClick={() => onOpenChange(false)}
          className="flex-1 rounded-xl border border-border bg-secondary/80 px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-secondary sm:flex-none"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
        >
          {upsert.isPending ? (
            <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save Availability
        </button>
      </div>
    </GlassModal>
  );
}
