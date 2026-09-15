'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BookOpen,
  Check,
  Clock,
  Flame,
  GripVertical,
  MousePointerClick,
  Pencil,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleItem } from '@/lib/queries';

// ─────────────────────────────────────────────
// Layout constants — full 24-hour day grid
// ─────────────────────────────────────────────

const GUTTER_PX = 64;
const ROW_H_PX = 68;
const PX_PER_MIN = ROW_H_PX / 60;
const DAY_END_MIN = 24 * 60;
const SNAP_MIN = 15;
const MIN_DURATION_MIN = 15;

// ─────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = (t ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(DAY_END_MIN - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime(t: string): string {
  const [h, m] = (t ?? '').split(':').map(Number);
  const hh = h || 0;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ampm}`;
}

function snap15(mins: number): number {
  return Math.round(mins / SNAP_MIN) * SNAP_MIN;
}

// ─────────────────────────────────────────────
// Subject themes — vivid, distinct, readable in both modes.
// Bigger type lives on top of a tinted surface + bold accent bar.
// ─────────────────────────────────────────────

interface SubjectTheme {
  tile: string;
  border: string;
  accent: string;
  title: string;
  badge: string;
  dot: string;
}

const THEMES: SubjectTheme[] = [
  {
    tile: 'bg-indigo-500/[0.13] dark:bg-indigo-400/[0.14]',
    border: 'border-indigo-500/40 dark:border-indigo-400/40',
    accent: 'bg-indigo-500',
    title: 'text-indigo-900 dark:text-indigo-100',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    tile: 'bg-violet-500/[0.13] dark:bg-violet-400/[0.14]',
    border: 'border-violet-500/40 dark:border-violet-400/40',
    accent: 'bg-violet-500',
    title: 'text-violet-900 dark:text-violet-100',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  {
    tile: 'bg-cyan-500/[0.13] dark:bg-cyan-400/[0.14]',
    border: 'border-cyan-600/40 dark:border-cyan-400/40',
    accent: 'bg-cyan-500',
    title: 'text-cyan-900 dark:text-cyan-100',
    badge: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200',
    dot: 'bg-cyan-500',
  },
  {
    tile: 'bg-emerald-500/[0.13] dark:bg-emerald-400/[0.14]',
    border: 'border-emerald-600/40 dark:border-emerald-400/40',
    accent: 'bg-emerald-500',
    title: 'text-emerald-900 dark:text-emerald-100',
    badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    tile: 'bg-amber-500/[0.16] dark:bg-amber-400/[0.14]',
    border: 'border-amber-500/50 dark:border-amber-400/40',
    accent: 'bg-amber-500',
    title: 'text-amber-900 dark:text-amber-100',
    badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  {
    tile: 'bg-rose-500/[0.13] dark:bg-rose-400/[0.14]',
    border: 'border-rose-500/40 dark:border-rose-400/40',
    accent: 'bg-rose-500',
    title: 'text-rose-900 dark:text-rose-100',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
  {
    tile: 'bg-orange-500/[0.13] dark:bg-orange-400/[0.14]',
    border: 'border-orange-500/40 dark:border-orange-400/40',
    accent: 'bg-orange-500',
    title: 'text-orange-900 dark:text-orange-100',
    badge: 'bg-orange-500/15 text-orange-800 dark:text-orange-200',
    dot: 'bg-orange-500',
  },
  {
    tile: 'bg-sky-500/[0.13] dark:bg-sky-400/[0.14]',
    border: 'border-sky-500/40 dark:border-sky-400/40',
    accent: 'bg-sky-500',
    title: 'text-sky-900 dark:text-sky-100',
    badge: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
    dot: 'bg-sky-500',
  },
  {
    tile: 'bg-fuchsia-500/[0.13] dark:bg-fuchsia-400/[0.14]',
    border: 'border-fuchsia-500/40 dark:border-fuchsia-400/40',
    accent: 'bg-fuchsia-500',
    title: 'text-fuchsia-900 dark:text-fuchsia-100',
    badge: 'bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
  {
    tile: 'bg-lime-500/[0.14] dark:bg-lime-400/[0.14]',
    border: 'border-lime-600/40 dark:border-lime-400/40',
    accent: 'bg-lime-500',
    title: 'text-lime-900 dark:text-lime-100',
    badge: 'bg-lime-500/20 text-lime-800 dark:text-lime-200',
    dot: 'bg-lime-500',
  },
];

const KNOWN_SUBJECT_INDEX: Record<string, number> = {
  dsa: 0,
  'computer science': 0,
  mathematics: 1,
  maths: 1,
  math: 1,
  physics: 2,
  chemistry: 3,
  biology: 9,
  history: 4,
  polity: 6,
  economics: 6,
  english: 8,
  geography: 3,
  break: 4,
};

function getTheme(subject?: string): SubjectTheme {
  if (subject) {
    const key = subject.toLowerCase().trim();
    if (key in KNOWN_SUBJECT_INDEX) return THEMES[KNOWN_SUBJECT_INDEX[key]];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return THEMES[hash % THEMES.length];
  }
  return THEMES[7];
}

const PRIORITY_META: Record<string, { icon: React.ReactNode; label: string }> = {
  high: { icon: <Flame className="h-3.5 w-3.5 text-rose-500" />, label: 'High priority' },
  medium: { icon: <Star className="h-3.5 w-3.5 text-amber-500" />, label: 'Medium priority' },
  low: { icon: <BookOpen className="h-3.5 w-3.5 text-sky-500" />, label: 'Low priority' },
};

// ─────────────────────────────────────────────
// Overlap layout — side-by-side lanes per overlap group
// ─────────────────────────────────────────────

interface LaidOutItem {
  item: ScheduleItem;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
}

function layoutItems(items: ScheduleItem[]): LaidOutItem[] {
  const sorted = [...items].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  // Split into overlap groups so lane counts stay local to each cluster.
  const groups: ScheduleItem[][] = [];
  let current: ScheduleItem[] = [];
  let groupEnd = -1;
  for (const item of sorted) {
    const start = timeToMinutes(item.startTime);
    const end = Math.max(timeToMinutes(item.endTime), start + 1);
    if (current.length === 0 || start < groupEnd) {
      current.push(item);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push(current);
      current = [item];
      groupEnd = end;
    }
  }
  if (current.length > 0) groups.push(current);

  const out: LaidOutItem[] = [];
  for (const group of groups) {
    const laneEnds: number[] = [];
    const placed: LaidOutItem[] = group.map((item) => {
      const startMin = timeToMinutes(item.startTime);
      const endMin = Math.max(timeToMinutes(item.endTime), startMin + 1);
      let lane = laneEnds.findIndex((e) => e <= startMin);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endMin;
      return {
        item,
        top: startMin * PX_PER_MIN,
        height: Math.max((endMin - startMin) * PX_PER_MIN, 56),
        lane,
        laneCount: 1,
      };
    });
    const n = Math.max(laneEnds.length, 1);
    for (const p of placed) p.laneCount = n;
    out.push(...placed);
  }
  return out;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ScheduleTimelineProps {
  items: ScheduleItem[];
  onToggleItem: (itemId: string, completed: boolean) => void;
  onRescheduleItem: (itemId: string, newStart: string, newEnd: string) => void;
  reschedulingId?: string | null;
}

interface DragState {
  itemId: string;
  durationMins: number;
  grabOffsetPx: number;
  cursorX: number;
  cursorY: number;
  overMins: number | null;
  inside: boolean;
}

// ─────────────────────────────────────────────
// Main board
// ─────────────────────────────────────────────

export default function ScheduleTimeline({
  items,
  onToggleItem,
  onRescheduleItem,
  reschedulingId,
}: ScheduleTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const laidOut = useMemo(() => layoutItems(items), [items]);
  const sortedTiles = useMemo(
    () => [...items].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [items]
  );

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = nowMins * PX_PER_MIN;
  const activeItemId = items.find(
    (i) => !i.completed && timeToMinutes(i.startTime) <= nowMins && timeToMinutes(i.endTime) > nowMins
  )?.id;

  // Bring the current hour into view on mount.
  useEffect(() => {
    if (nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const minutesFromClientY = useCallback((clientY: number, grabOffsetPx: number): number | null => {
    const el = contentRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top - grabOffsetPx;
    return y / PX_PER_MIN;
  }, []);

  const commitDrag = useCallback(
    (state: DragState) => {
      const item = itemById.get(state.itemId);
      if (item && state.overMins !== null && state.inside) {
        const clamped = Math.max(0, Math.min(DAY_END_MIN - state.durationMins, state.overMins));
        const newStart = minutesToTime(clamped);
        const newEnd = minutesToTime(clamped + state.durationMins);
        if (newStart !== item.startTime || newEnd !== item.endTime) {
          onRescheduleItem(state.itemId, newStart, newEnd);
        }
      }
      setDrag(null);
      setHoverHour(null);
    },
    [itemById, onRescheduleItem]
  );

  // Window-level move/up listeners active only while dragging.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const prev = dragRef.current;
      if (!prev) return;
      const raw = minutesFromClientY(e.clientY, prev.grabOffsetPx);
      let overMins: number | null = null;
      let inside = false;
      if (raw !== null) {
        const el = contentRef.current;
        const rect = el?.getBoundingClientRect();
        if (rect) {
          inside = e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40;
          if (inside) {
            overMins = snap15(Math.max(0, Math.min(DAY_END_MIN - prev.durationMins, raw)));
            setHoverHour(Math.floor(Math.max(0, Math.min(DAY_END_MIN - 1, overMins)) / 60));
          }
        }
      }
      setDrag({ ...prev, cursorX: e.clientX, cursorY: e.clientY, overMins, inside });

      // Gentle auto-scroll near the scroll container edges.
      const scroller = scrollRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 72) scroller.scrollTop -= 10;
        else if (e.clientY > r.bottom - 72) scroller.scrollTop += 10;
      }
    };
    const onUp = () => {
      const prev = dragRef.current;
      if (prev) commitDrag(prev);
    };
    const onCancel = () => {
      setDrag(null);
      setHoverHour(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [drag !== null, minutesFromClientY, commitDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginDrag = useCallback(
    (e: React.PointerEvent, item: ScheduleItem, grabOffsetPx: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const durationMins = Math.max(
        MIN_DURATION_MIN,
        timeToMinutes(item.endTime) - timeToMinutes(item.startTime)
      );
      setSelectedId(item.id);
      setDrag({
        itemId: item.id,
        durationMins,
        grabOffsetPx,
        cursorX: e.clientX,
        cursorY: e.clientY,
        overMins: null,
        inside: false,
      });
    },
    []
  );

  const placeSelectedAtHour = useCallback(
    (hour: number) => {
      if (!selectedId) return;
      const item = itemById.get(selectedId);
      if (!item) return;
      const durationMins = Math.max(
        MIN_DURATION_MIN,
        timeToMinutes(item.endTime) - timeToMinutes(item.startTime)
      );
      const start = Math.min(hour * 60, DAY_END_MIN - durationMins);
      const newStart = minutesToTime(start);
      const newEnd = minutesToTime(start + durationMins);
      if (newStart !== item.startTime || newEnd !== item.endTime) {
        onRescheduleItem(item.id, newStart, newEnd);
      }
    },
    [selectedId, itemById, onRescheduleItem]
  );

  const nudgeSelected = useCallback(
    (itemId: string, deltaMins: number) => {
      const item = itemById.get(itemId);
      if (!item) return;
      const durationMins = Math.max(
        MIN_DURATION_MIN,
        timeToMinutes(item.endTime) - timeToMinutes(item.startTime)
      );
      const start = Math.max(0, Math.min(DAY_END_MIN - durationMins, timeToMinutes(item.startTime) + deltaMins));
      onRescheduleItem(item.id, minutesToTime(start), minutesToTime(start + durationMins));
    },
    [itemById, onRescheduleItem]
  );

  const openEditor = useCallback((item: ScheduleItem) => {
    setEditingId(item.id);
    setEditStart(item.startTime.slice(0, 5));
    setEditEnd(item.endTime.slice(0, 5));
  }, []);

  const saveEditor = useCallback(() => {
    if (!editingId) return;
    const s = timeToMinutes(editStart);
    const e = timeToMinutes(editEnd);
    if (e > s) onRescheduleItem(editingId, minutesToTime(s), minutesToTime(e));
    setEditingId(null);
  }, [editingId, editStart, editEnd, onRescheduleItem]);

  const draggingItem = drag ? itemById.get(drag.itemId) : undefined;
  const dragTheme = getTheme(draggingItem?.subject);
  const contentHeight = DAY_END_MIN * PX_PER_MIN;

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ── Task tiles — the draggable palette ── */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            Tasks — drag onto the day
          </p>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Drag the grip onto any hour, or click a task then click an hour
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sortedTiles.map((item) => {
            const theme = getTheme(item.subject);
            const isSelected = item.id === selectedId;
            const isDragging = drag?.itemId === item.id;
            const durationMins = Math.max(timeToMinutes(item.endTime) - timeToMinutes(item.startTime), 0);
            return (
              <li
                key={item.id}
                onClick={() => setSelectedId(isSelected ? null : item.id)}
                className={cn(
                  'relative cursor-pointer overflow-hidden rounded-xl border text-left transition-all duration-150',
                  theme.tile,
                  theme.border,
                  isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  isDragging ? 'opacity-40' : 'hover:-translate-y-px hover:shadow-md',
                  item.completed && 'opacity-60'
                )}
              >
                <span className={cn('absolute inset-y-0 left-0 w-1.5', theme.accent)} />
                <span className="flex items-stretch gap-1 py-2.5 pl-4 pr-2">
                  <button
                    type="button"
                    aria-label={`Drag ${item.taskTitle} to reschedule`}
                    title="Drag to reschedule (arrow keys nudge by 15 min)"
                    onPointerDown={(e) => {
                      const el = (e.target as HTMLElement).closest('li');
                      const rect = el?.getBoundingClientRect();
                      beginDrag(e, item, rect ? e.clientY - rect.top : 24);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        nudgeSelected(item.id, -SNAP_MIN);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        nudgeSelected(item.id, SNAP_MIN);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground active:cursor-grabbing dark:hover:bg-white/10"
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', theme.dot)} />
                      {formatTime(item.startTime)} — {formatTime(item.endTime)}
                      <span aria-hidden="true">·</span> {durationMins}m
                      {item.id === activeItemId && !item.completed && (
                        <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                          Live
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[15px] font-semibold leading-snug',
                        theme.title,
                        item.completed && 'line-through'
                      )}
                      title={item.taskTitle}
                    >
                      {item.taskTitle}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      {item.subject && (
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', theme.badge)}>
                          {item.subject}
                        </span>
                      )}
                      {item.priority && PRIORITY_META[item.priority] && (
                        <span title={PRIORITY_META[item.priority].label}>
                          {PRIORITY_META[item.priority].icon}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleItem(item.id, !item.completed)}
                      aria-pressed={item.completed}
                      aria-label={item.completed ? `Mark ${item.taskTitle} incomplete` : `Mark ${item.taskTitle} complete`}
                      className={cn(
                        'flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors',
                        item.completed
                          ? 'bg-emerald-600 text-white'
                          : 'border border-border/70 bg-background text-muted-foreground hover:border-emerald-600/50 hover:text-emerald-600'
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(item)}
                      aria-label={`Edit time for ${item.taskTitle}`}
                      title="Edit start / end time"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Day grid — all 24 hour rows, droppable ── */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Day timeline — all hours
          </p>
          {selectedId && itemById.get(selectedId) && (
            <p className="truncate text-[11px] font-medium text-primary">
              Placing “{itemById.get(selectedId)?.taskTitle}” — click any hour
            </p>
          )}
        </div>

        <div
          ref={scrollRef}
          className="max-h-[720px] overflow-x-auto overflow-y-auto rounded-xl border border-border/60 bg-card"
        >
          <div ref={contentRef} className="relative min-w-[32rem] sm:min-w-0" style={{ height: `${contentHeight}px` }}>
            {/* Hour rows */}
            {Array.from({ length: 24 }, (_, h) => {
              const top = h * ROW_H_PX;
              const isHover = hoverHour === h;
              const isNowHour = Math.floor(nowMins / 60) === h;
              return (
                <div
                  key={h}
                  role="button"
                  tabIndex={selectedId ? 0 : -1}
                  aria-label={`${formatHour(h)} — ${selectedId ? 'click to place selected task here' : 'hour row'}`}
                  onClick={() => selectedId && placeSelectedAtHour(h)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && selectedId) {
                      e.preventDefault();
                      placeSelectedAtHour(h);
                    }
                  }}
                  onMouseEnter={() => selectedId && !drag && setHoverHour(h)}
                  onMouseLeave={() => !drag && setHoverHour(null)}
                  className={cn(
                    'absolute left-0 right-0 flex border-b border-border/40 transition-colors',
                    selectedId && 'cursor-pointer',
                    isHover
                      ? 'bg-primary/[0.08]'
                      : isNowHour
                        ? 'bg-primary/[0.03]'
                        : h % 2 === 1
                          ? 'bg-muted/[0.25]'
                          : 'bg-transparent',
                    selectedId && !isHover && 'hover:bg-primary/[0.05]'
                  )}
                  style={{ top: `${top}px`, height: `${ROW_H_PX}px` }}
                >
                  <span
                    className={cn(
                      'flex w-16 shrink-0 select-none flex-col items-end justify-start pr-2 pt-1.5 font-mono text-[11px] font-medium leading-none',
                      isHover ? 'text-primary' : 'text-muted-foreground'
                    )}
                    style={{ width: `${GUTTER_PX}px` }}
                  >
                    {formatHour(h)}
                  </span>
                  <span className="relative flex-1">
                    <span className="absolute inset-x-0 top-0 border-t border-border/50" />
                    {/* half-hour guide */}
                    <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/30" />
                    {isHover && (
                      <span className="absolute inset-1 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 text-xs font-semibold text-primary">
                        {drag && drag.overMins !== null
                          ? `${formatTime(minutesToTime(drag.overMins))} — ${formatTime(minutesToTime(drag.overMins + drag.durationMins))}`
                          : `Place here — ${formatHour(h)}`}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Current-time marker */}
            <div
              ref={nowRef}
              className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
              style={{ top: `${nowTop}px` }}
            >
              <span
                className="shrink-0 pr-2 text-right text-[10px] font-bold text-primary"
                style={{ width: `${GUTTER_PX}px` }}
              >
                NOW
              </span>
              <span className="relative flex-1 border-t-2 border-dashed border-primary">
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow"
                  style={{ left: '-5px' }}
                />
              </span>
            </div>

            {/* Drop preview while dragging */}
            {drag && drag.overMins !== null && drag.inside && (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border-2 border-dashed border-primary bg-primary/10"
                style={{
                  top: `${Math.max(0, Math.min(DAY_END_MIN - drag.durationMins, drag.overMins)) * PX_PER_MIN}px`,
                  height: `${drag.durationMins * PX_PER_MIN}px`,
                  left: `${GUTTER_PX + 6}px`,
                  right: '8px',
                }}
              />
            )}

            {/* Placed blocks */}
            {laidOut.map(({ item, top, height, lane, laneCount }) => {
              const theme = getTheme(item.subject);
              const isActive = item.id === activeItemId;
              const isBeingDragged = drag?.itemId === item.id;
              const isSaving = reschedulingId === item.id;
              const laneWidthPct = 100 / laneCount;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'absolute overflow-hidden rounded-lg border text-left shadow-sm transition-all duration-150',
                    theme.tile,
                    theme.border,
                    isBeingDragged ? 'opacity-30' : 'hover:shadow-md',
                    item.completed && 'opacity-60',
                    isActive && !item.completed && 'ring-2 ring-primary/60'
                  )}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${GUTTER_PX}px + 6px + (100% - ${GUTTER_PX}px - 14px) * ${lane * laneWidthPct} / 100)`,
                    width: `calc((100% - ${GUTTER_PX}px - 14px) * ${laneWidthPct} / 100 - 4px)`,
                    zIndex: isActive ? 10 : 5,
                  }}
                >
                  <span className={cn('absolute inset-y-0 left-0 w-1', theme.accent)} />
                  <div className="flex h-full items-start gap-1 py-1.5 pl-2.5 pr-1.5">
                    <button
                      type="button"
                      aria-label={`Drag ${item.taskTitle} to another time`}
                      title="Drag to move · ↑/↓ nudge 15 min"
                      onPointerDown={(e) => {
                        const target = (e.currentTarget as HTMLElement).closest('div[class*="absolute"]') as HTMLElement | null;
                        const rect = target?.getBoundingClientRect();
                        beginDrag(e, item, rect ? e.clientY - rect.top : 24);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          nudgeSelected(item.id, -SNAP_MIN);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          nudgeSelected(item.id, SNAP_MIN);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 flex shrink-0 cursor-grab touch-none items-center justify-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-black/5 hover:text-foreground active:cursor-grabbing dark:hover:bg-white/10"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] font-medium text-muted-foreground">
                        {formatTime(item.startTime)} — {formatTime(item.endTime)}
                      </p>
                      <p
                        className={cn(
                          'truncate text-[15px] font-semibold leading-snug',
                          theme.title,
                          item.completed && 'line-through'
                        )}
                        title={item.taskTitle}
                      >
                        {item.taskTitle}
                      </p>
                      {height >= 76 && item.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs leading-tight text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1.5">
                        {item.subject && (
                          <span className={cn('rounded px-1 py-px text-[10px] font-semibold', theme.badge)}>
                            {item.subject}
                          </span>
                        )}
                        {isSaving && <span className="text-[10px] font-medium text-primary">Saving…</span>}
                      </p>
                    </div>
                    <span className="flex shrink-0 flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleItem(item.id, !item.completed)}
                        aria-pressed={item.completed}
                        aria-label={item.completed ? `Mark ${item.taskTitle} incomplete` : `Mark ${item.taskTitle} complete`}
                        className={cn(
                          'flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors',
                          item.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border border-border/70 bg-background text-muted-foreground hover:border-emerald-600/50 hover:text-emerald-600'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <span
                        title={item.alarmFired ? 'Alarm fired' : 'Alarm set'}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-md',
                          item.alarmFired ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'text-muted-foreground/40'
                        )}
                      >
                        {item.alarmFired ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Times snap to 15-minute steps. Task length is preserved when you move it.
        </p>
      </div>

      {/* ── Floating drag ghost ── */}
      {drag && draggingItem && (
        <div
          className={cn(
            'pointer-events-none fixed z-50 w-64 overflow-hidden rounded-xl border shadow-xl',
            dragTheme.tile,
            dragTheme.border
          )}
          style={{
            left: `${Math.min(Math.max(drag.cursorX - 128, 8), window.innerWidth - 272)}px`,
            top: `${drag.cursorY - 30}px`,
          }}
        >
          <span className={cn('absolute inset-y-0 left-0 w-1.5', dragTheme.accent)} />
          <div className="py-2 pl-4 pr-3">
            <p className="text-xs font-semibold text-primary">
              {drag.overMins !== null && drag.inside
                ? `${formatTime(minutesToTime(drag.overMins))} — ${formatTime(minutesToTime(drag.overMins + drag.durationMins))}`
                : 'Release over the timeline to place'}
            </p>
            <p className={cn('truncate text-[15px] font-semibold', dragTheme.title)}>{draggingItem.taskTitle}</p>
          </div>
        </div>
      )}

      {/* ── Precise time editor ── */}
      {editingId && itemById.get(editingId) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit task time">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold leading-snug">{itemById.get(editingId)?.taskTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Set an exact start and end time.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Close time editor"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Start</span>
                <input
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-2 text-sm font-medium focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">End</span>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-2 text-sm font-medium focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex-1 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
