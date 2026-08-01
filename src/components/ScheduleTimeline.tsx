'use client';

import { useRef, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, BellOff, Check, Flame, Star, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleItem } from '@/lib/queries';

// ─────────────────────────────────────────────
// Layout constants
//
// The timeline is laid out in pixels rather than percentages. A percentage
// scale made short blocks collapse until their text was unreadable, and it
// decoupled block offsets from the hour gridlines. One shared gutter width and
// one shared pixels-per-minute scale keep labels, gridlines, the "now" marker,
// and task blocks on the same axis.
// ─────────────────────────────────────────────

const GUTTER_PX = 68; // width of the hour-label column
const PX_PER_MIN = 1.7;
const MIN_BLOCK_PX = 68; // enough vertical room for time + title + meta row
const LANE_GAP_PX = 6;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = (t ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(t: string): string {
  const [h, m] = (t ?? '').split(':').map(Number);
  const ampm = (h || 0) >= 12 ? 'PM' : 'AM';
  const hour = (h || 0) % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

/**
 * Subject palette.
 *
 * Blocks sit on a solid card surface with a coloured left accent instead of a
 * translucent colour wash, so labels keep their contrast on both the light and
 * dark themes. Text tones are declared per theme for the same reason.
 */
const SUBJECT_COLORS: Record<string, { accent: string; text: string; dot: string }> = {
  dsa: {
    accent: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  mathematics: {
    accent: 'border-l-violet-500',
    text: 'text-violet-700 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  maths: {
    accent: 'border-l-violet-500',
    text: 'text-violet-700 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  physics: {
    accent: 'border-l-cyan-600',
    text: 'text-cyan-700 dark:text-cyan-200',
    dot: 'bg-cyan-500',
  },
  chemistry: {
    accent: 'border-l-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  biology: {
    accent: 'border-l-lime-600',
    text: 'text-lime-700 dark:text-lime-200',
    dot: 'bg-lime-500',
  },
  history: {
    accent: 'border-l-amber-600',
    text: 'text-amber-700 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  polity: {
    accent: 'border-l-orange-600',
    text: 'text-orange-700 dark:text-orange-200',
    dot: 'bg-orange-500',
  },
  break: {
    accent: 'border-l-zinc-400',
    text: 'text-zinc-600 dark:text-zinc-300',
    dot: 'bg-zinc-400',
  },
  default: { accent: 'border-l-primary', text: 'text-primary', dot: 'bg-primary' },
};

function getSubjectColor(subject?: string) {
  if (!subject) return SUBJECT_COLORS.default;
  return SUBJECT_COLORS[subject.toLowerCase().trim()] ?? SUBJECT_COLORS.default;
}

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  high: <Flame className="h-3 w-3 text-rose-500 dark:text-rose-400" />,
  medium: <Star className="h-3 w-3 text-amber-500 dark:text-amber-400" />,
  low: <BookOpen className="h-3 w-3 text-sky-500 dark:text-sky-400" />,
};

interface LaidOutItem {
  item: ScheduleItem;
  top: number;
  height: number;
  lane: number;
}

/**
 * Assigns overlapping blocks to side-by-side lanes so a long block can never
 * hide a shorter one that runs at the same time.
 */
function layoutItems(items: ScheduleItem[], rangeStart: number) {
  const sorted = [...items].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const laneEnds: number[] = [];
  const laidOut: LaidOutItem[] = sorted.map((item) => {
    const startMin = timeToMinutes(item.startTime);
    const endMin = Math.max(timeToMinutes(item.endTime), startMin + 1);
    const durationPx = (endMin - startMin) * PX_PER_MIN;

    let lane = laneEnds.findIndex((end) => end <= startMin);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = endMin;

    return {
      item,
      top: (startMin - rangeStart) * PX_PER_MIN,
      height: Math.max(durationPx, MIN_BLOCK_PX),
      lane,
    };
  });

  return { laidOut, laneCount: Math.max(laneEnds.length, 1) };
}

// ─────────────────────────────────────────────
// Task Block
// ─────────────────────────────────────────────

interface TaskBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  isActive: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
}

const TaskBlock = memo(function TaskBlock({
  item,
  top,
  height,
  lane,
  laneCount,
  isActive,
  onToggle,
}: TaskBlockProps) {
  const reduce = useReducedMotion();
  const colors = getSubjectColor(item.subject);
  const durationMins = Math.max(timeToMinutes(item.endTime) - timeToMinutes(item.startTime), 0);
  const showDescription = Boolean(item.description) && height >= 104;
  const laneWidth = `((100% - ${GUTTER_PX}px) / ${laneCount})`;

  return (
    <motion.div
      layout
      initial={reduce ? {} : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'absolute overflow-hidden rounded-xl border border-l-[3px] border-border/70 px-3 py-2 select-none',
        'bg-card/95 shadow-sm backdrop-blur-sm transition-shadow duration-200 dark:bg-card/85',
        colors.accent,
        item.completed && 'opacity-60',
        isActive && !item.completed && 'ring-2 ring-primary/60 shadow-md shadow-primary/10'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${GUTTER_PX}px + ${laneWidth} * ${lane} + ${LANE_GAP_PX}px)`,
        width: `calc(${laneWidth} - ${LANE_GAP_PX * 2}px)`,
        zIndex: isActive ? 10 : 5,
      }}
    >
      <div className="flex h-full items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', colors.dot)} />
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTime(item.startTime)} — {formatTime(item.endTime)}
            </span>
            {isActive && !item.completed && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                Live
              </span>
            )}
          </div>

          <p
            className={cn(
              'truncate text-sm font-semibold leading-tight',
              colors.text,
              item.completed && 'line-through'
            )}
            title={item.taskTitle}
          >
            {item.taskTitle}
          </p>

          {showDescription && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">
              {item.description}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {item.subject && (
              <span
                className={cn(
                  'rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium',
                  colors.text
                )}
              >
                {item.subject}
              </span>
            )}
            {item.priority && PRIORITY_ICON[item.priority]}
            <span className="text-[10px] text-muted-foreground">{durationMins}m</span>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggle(item.id, !item.completed)}
            aria-pressed={item.completed}
            aria-label={
              item.completed
                ? `Mark ${item.taskTitle} incomplete`
                : `Mark ${item.taskTitle} complete`
            }
            title={item.completed ? 'Mark incomplete' : 'Mark complete'}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-200',
              item.completed
                ? 'bg-emerald-600 text-white'
                : 'border border-border bg-secondary text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-300'
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          <span
            title={item.alarmFired ? 'Alarm fired' : 'Alarm set'}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-lg',
              item.alarmFired
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                : 'bg-secondary text-muted-foreground'
            )}
          >
            {item.alarmFired ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          </span>

          {item.completed && item.pointsAwarded ? (
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
              +{item.pointsAwarded}pt
            </span>
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

  // Snap the visible window to whole hours so gridlines and blocks share an origin.
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (items.length === 0) return { rangeStart: 0, rangeEnd: 0 };
    const starts = items.map((i) => timeToMinutes(i.startTime));
    const ends = items.map((i) => timeToMinutes(i.endTime));
    return {
      rangeStart: Math.max(0, Math.floor(Math.min(...starts) / 60) * 60),
      rangeEnd: Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60),
    };
  }, [items]);

  const totalMins = Math.max(rangeEnd - rangeStart, 60);
  const { laidOut, laneCount } = useMemo(() => layoutItems(items, rangeStart), [items, rangeStart]);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowVisible = nowMins >= rangeStart && nowMins <= rangeEnd;
  const nowTop = (nowMins - rangeStart) * PX_PER_MIN;

  const activeItemId = items.find(
    (i) =>
      !i.completed && timeToMinutes(i.startTime) <= nowMins && timeToMinutes(i.endTime) > nowMins
  )?.id;

  const hours = useMemo(() => {
    const startHour = Math.floor(rangeStart / 60);
    const endHour = Math.ceil(rangeEnd / 60);
    return Array.from({ length: Math.max(endHour - startHour + 1, 1) }, (_, i) => startHour + i);
  }, [rangeStart, rangeEnd]);

  // Bring the current hour into view without yanking the whole page.
  useEffect(() => {
    if (nowRef.current && nowVisible) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [nowVisible]);

  if (items.length === 0) return null;

  const contentHeight = Math.max(totalMins * PX_PER_MIN, MIN_BLOCK_PX * 2);

  return (
    <div className="relative w-full" style={{ height: `${contentHeight}px` }}>
      {/* Hour gridlines */}
      {hours.map((h) => {
        const top = (h * 60 - rangeStart) * PX_PER_MIN;
        if (top < 0 || top > contentHeight) return null;
        const ampm = h >= 12 ? 'PM' : 'AM';
        return (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: `${top}px` }}
          >
            <span
              className="flex-shrink-0 select-none pr-3 text-right font-mono text-[10px] text-muted-foreground"
              style={{ width: `${GUTTER_PX}px` }}
            >
              {`${h % 12 || 12} ${ampm}`}
            </span>
            <span className="flex-1 border-t border-border/50" />
          </div>
        );
      })}

      {/* Current time indicator */}
      {nowVisible && (
        <div
          ref={nowRef}
          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
          style={{ top: `${nowTop}px` }}
        >
          <span
            className="flex-shrink-0 pr-3 text-right text-[10px] font-bold text-primary"
            style={{ width: `${GUTTER_PX}px` }}
          >
            NOW
          </span>
          <span className="flex-1 border-t-2 border-dashed border-primary" />
          <span
            className="absolute h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm"
            style={{ left: `${GUTTER_PX - 5}px` }}
          />
        </div>
      )}

      {/* Task blocks */}
      <AnimatePresence>
        {laidOut.map(({ item, top, height, lane }) => (
          <TaskBlock
            key={item.id}
            item={item}
            top={top}
            height={height}
            lane={lane}
            laneCount={laneCount}
            isActive={item.id === activeItemId}
            onToggle={onToggleItem}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
