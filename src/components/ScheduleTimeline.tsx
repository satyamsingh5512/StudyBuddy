'use client';

import { useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, BellOff, Check, Clock, Flame, Star, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleItem } from '@/lib/queries';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function minutesToPosition(minutes: number, startMin: number, totalMins: number): number {
  return ((minutes - startMin) / totalMins) * 100;
}

function minutesToHeight(durationMins: number, totalMins: number): number {
  return (durationMins / totalMins) * 100;
}

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  dsa: { bg: 'bg-blue-500/15', border: 'border-blue-400/40', text: 'text-blue-300', dot: 'bg-blue-400' },
  mathematics: { bg: 'bg-violet-500/15', border: 'border-violet-400/40', text: 'text-violet-300', dot: 'bg-violet-400' },
  maths: { bg: 'bg-violet-500/15', border: 'border-violet-400/40', text: 'text-violet-300', dot: 'bg-violet-400' },
  physics: { bg: 'bg-cyan-500/15', border: 'border-cyan-400/40', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  chemistry: { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  biology: { bg: 'bg-lime-500/15', border: 'border-lime-400/40', text: 'text-lime-300', dot: 'bg-lime-400' },
  history: { bg: 'bg-amber-500/15', border: 'border-amber-400/40', text: 'text-amber-300', dot: 'bg-amber-400' },
  polity: { bg: 'bg-orange-500/15', border: 'border-orange-400/40', text: 'text-orange-300', dot: 'bg-orange-400' },
  break: { bg: 'bg-zinc-500/15', border: 'border-zinc-400/40', text: 'text-zinc-400', dot: 'bg-zinc-400' },
  default: { bg: 'bg-primary/15', border: 'border-primary/40', text: 'text-primary', dot: 'bg-primary' },
};

function getSubjectColor(subject?: string) {
  if (!subject) return SUBJECT_COLORS.default;
  const key = subject.toLowerCase().trim();
  return SUBJECT_COLORS[key] ?? SUBJECT_COLORS.default;
}

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  high: <Flame className="h-3 w-3 text-rose-400" />,
  medium: <Star className="h-3 w-3 text-amber-400" />,
  low: <BookOpen className="h-3 w-3 text-sky-400" />,
};

// ─────────────────────────────────────────────
// Task Block
// ─────────────────────────────────────────────

interface TaskBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  isActive: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
}

const TaskBlock = memo(function TaskBlock({ item, top, height, isActive, onToggle }: TaskBlockProps) {
  const reduce = useReducedMotion();
  const colors = getSubjectColor(item.subject);
  const durationMins = timeToMinutes(item.endTime) - timeToMinutes(item.startTime);
  const compact = height < 5; // less than ~30px

  return (
    <motion.div
      layout
      initial={reduce ? {} : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'absolute left-16 right-2 rounded-xl border px-3 py-2 cursor-default select-none',
        'transition-all duration-200',
        colors.bg,
        colors.border,
        item.completed && 'opacity-50 grayscale',
        isActive && !item.completed && 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
      )}
      style={{
        top: `${top}%`,
        height: `max(${height}%, 48px)`,
        zIndex: isActive ? 10 : 5,
      }}
    >
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 min-w-0">
          {/* Time label */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', colors.dot)} />
            <span className="text-[10px] font-mono text-muted-foreground">
              {formatTime(item.startTime)} — {formatTime(item.endTime)}
            </span>
            {isActive && !item.completed && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-wide animate-pulse">
                Live
              </span>
            )}
          </div>

          {!compact && (
            <>
              <p className={cn('text-sm font-semibold leading-tight truncate', item.completed && 'line-through', colors.text)}>
                {item.taskTitle}
              </p>
              {item.description && height > 7 && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-tight">{item.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                {item.subject && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-background/40', colors.text)}>
                    {item.subject}
                  </span>
                )}
                {item.priority && PRIORITY_ICON[item.priority]}
                <span className="text-[10px] text-muted-foreground/60">{durationMins}m</span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            onClick={() => onToggle(item.id, !item.completed)}
            title={item.completed ? 'Mark incomplete' : 'Mark complete'}
            className={cn(
              'h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-200',
              item.completed
                ? 'bg-emerald-500/80 text-white'
                : 'bg-background/40 border border-border/50 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400'
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          <div
            title={item.alarmFired ? 'Alarm fired' : 'Alarm set'}
            className={cn(
              'h-6 w-6 rounded-lg flex items-center justify-center',
              item.alarmFired
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-background/40 text-muted-foreground/50'
            )}
          >
            {item.alarmFired ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          </div>

          {item.completed && item.pointsAwarded ? (
            <span className="text-[9px] font-bold text-emerald-400">+{item.pointsAwarded}pt</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────
// Main Timeline
// ─────────────────────────────────────────────

interface ScheduleTimelineProps {
  items: ScheduleItem[];
  onToggleItem: (itemId: string, completed: boolean) => void;
}

export default function ScheduleTimeline({ items, onToggleItem }: ScheduleTimelineProps) {
  const nowRef = useRef<HTMLDivElement>(null);

  // Compute time range from items (add 30 min buffer each side)
  const allStartMins = items.map((i) => timeToMinutes(i.startTime));
  const allEndMins = items.map((i) => timeToMinutes(i.endTime));
  const rangeStart = Math.max(0, Math.min(...allStartMins) - 30);
  const rangeEnd = Math.min(24 * 60, Math.max(...allEndMins) + 30);
  const totalMins = rangeEnd - rangeStart;

  // Current time marker
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowPct = minutesToPosition(nowMins, rangeStart, totalMins);
  const nowVisible = nowMins >= rangeStart && nowMins <= rangeEnd;

  // Hour lines
  const startHour = Math.floor(rangeStart / 60);
  const endHour = Math.ceil(rangeEnd / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Which item is currently "active"
  const activeItemId = items.find((i) => !i.completed && timeToMinutes(i.startTime) <= nowMins && timeToMinutes(i.endTime) > nowMins)?.id;

  // Scroll now indicator into view on mount
  useEffect(() => {
    if (nowRef.current && nowVisible) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [nowVisible]);

  if (items.length === 0) return null;

  return (
    <div className="relative w-full" style={{ height: `${Math.max(600, totalMins * 1.2)}px` }}>
      {/* Hour lines */}
      {hours.map((h) => {
        const pct = minutesToPosition(h * 60, rangeStart, totalMins);
        if (pct < 0 || pct > 100) return null;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const label = `${h % 12 || 12} ${ampm}`;
        return (
          <div key={h} className="absolute left-0 right-0 flex items-center" style={{ top: `${pct}%` }}>
            <span className="w-14 text-right pr-3 text-[10px] font-mono text-muted-foreground/50 select-none flex-shrink-0">
              {label}
            </span>
            <div className="flex-1 border-t border-border/20" />
          </div>
        );
      })}

      {/* Current time indicator */}
      {nowVisible && (
        <div
          ref={nowRef}
          className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
          style={{ top: `${nowPct}%` }}
        >
          <span className="w-14 text-right pr-2 text-[10px] font-bold text-primary flex-shrink-0">NOW</span>
          <div className="flex-1 border-t-2 border-primary border-dashed" />
          <div className="absolute left-[3.5rem] h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50 -translate-y-1.5" />
        </div>
      )}

      {/* Task blocks */}
      <AnimatePresence>
        {items.map((item) => {
          const top = minutesToPosition(timeToMinutes(item.startTime), rangeStart, totalMins);
          const height = minutesToHeight(
            timeToMinutes(item.endTime) - timeToMinutes(item.startTime),
            totalMins
          );
          return (
            <TaskBlock
              key={item.id}
              item={item}
              top={top}
              height={height}
              isActive={item.id === activeItemId}
              onToggle={onToggleItem}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
