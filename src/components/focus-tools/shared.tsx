'use client';

/**
 * Shared shell and primitives for the focus-tools sections.
 *
 * Each section on /focus-tools is its own memoized component so a write to one
 * setting re-renders only the card that owns it. The pieces they all need — the
 * collapsible card, the fixed-height skeleton that stands in for it while the
 * device is being read, day chips, and the app picker — live here so the sections
 * stay small and the sizing stays consistent.
 */

import { memo, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/Skeleton';
import type { LaunchableApp } from '@/lib/studyToolkit';

/** 1 = Sunday, matching both `Calendar.DAY_OF_WEEK` and the bridge payloads. */
export const DAY_LABELS = [
  { value: 2, short: 'Mon', long: 'Monday' },
  { value: 3, short: 'Tue', long: 'Tuesday' },
  { value: 4, short: 'Wed', long: 'Wednesday' },
  { value: 5, short: 'Thu', long: 'Thursday' },
  { value: 6, short: 'Fri', long: 'Friday' },
  { value: 7, short: 'Sat', long: 'Saturday' },
  { value: 1, short: 'Sun', long: 'Sunday' },
];

export const minutesToTime = (minutes: number): string => {
  const safe = Math.min(1439, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

export const timeToMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
};

export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
};

/**
 * How much vertical room each section occupies once loaded.
 *
 * The skeleton shown while the device is being read uses the same number, so the
 * page does not jump when the real controls arrive.
 */
export const SECTION_MIN_BODY = {
  permissions: 560,
  sounds: 320,
  zen: 300,
  nudges: 420,
  shorts: 560,
  appLimits: 260,
  activeBlocks: 220,
  launcher: 300,
} as const;

export interface SectionProps {
  /** Every native control is inert on the web and while a write is in flight. */
  disabled: boolean;
  /**
   * Runs one write and applies the slice it returns. Only the section that made the
   * call is updated; the rest of the page is left alone.
   */
  onRun: (key: string, action: () => Promise<void>, successMessage?: string) => void;
}

interface ToolSectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  minBodyHeight: number;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

/**
 * A titled card whose body can be collapsed on small screens.
 *
 * The toggle only exists below the `sm` breakpoint, and the body carries
 * `sm:block` so it is always visible on wider screens. Rendering it open on the
 * server and hiding it with CSS avoids both a hydration mismatch and the flash
 * that a media-query-driven initial state would cause.
 */
export const ToolSection = memo(function ToolSection({
  id,
  title,
  icon,
  minBodyHeight,
  open,
  onToggle,
  children,
}: ToolSectionProps) {
  const bodyId = `focus-tools-body-${id}`;
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => onToggle(id)}
            className="-my-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-1 py-2 text-left sm:pointer-events-none sm:min-h-0 sm:py-0"
          >
            <span aria-hidden="true" className="shrink-0 text-primary">
              {icon}
            </span>
            <span className="min-w-0 flex-1 break-words">{title}</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform sm:hidden ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent
        id={bodyId}
        style={{ minHeight: minBodyHeight }}
        className={`space-y-4 p-4 pt-0 sm:block sm:p-6 sm:pt-0 ${open ? 'block' : 'hidden'}`}
      >
        {children}
      </CardContent>
    </Card>
  );
});

/** Stand-in for a section while the device is being read. Same height, no shift. */
export const SectionSkeleton = memo(function SectionSkeleton({
  minBodyHeight,
}: {
  minBodyHeight: number;
}) {
  return (
    <Card aria-hidden="true">
      <CardHeader className="p-4 sm:p-6">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent style={{ minHeight: minBodyHeight }} className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
});

interface DayChipsProps {
  legend: string;
  selected: number[];
  disabled: boolean;
  namePrefix: string;
  onToggle: (day: number) => void;
}

/** Seven toggle chips, each a 40px-tall tap target so they work on a phone. */
export const DayChips = memo(function DayChips({
  legend,
  selected,
  disabled,
  namePrefix,
  onToggle,
}: DayChipsProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {DAY_LABELS.map((day) => {
          const on = selected.includes(day.value);
          return (
            <button
              key={`${namePrefix}-${day.value}`}
              type="button"
              aria-pressed={on}
              aria-label={day.long}
              disabled={disabled}
              onClick={() => onToggle(day.value)}
              className={`min-h-10 min-w-10 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
                on
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {day.short}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});

interface AppPickerProps {
  label: string;
  description?: string;
  apps: LaunchableApp[];
  selected: string[];
  disabled: boolean;
  nativeAvailable: boolean;
  idPrefix: string;
  onToggle: (packageName: string) => void;
}

/** Scrolling checkbox list of launchable apps, used by three of the sections. */
export const AppPicker = memo(function AppPicker({
  label,
  description,
  apps,
  selected,
  disabled,
  nativeAvailable,
  idPrefix,
  onToggle,
}: AppPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {apps.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {nativeAvailable ? 'No launchable apps found.' : 'Available in the Android app.'}
        </p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
          {apps.map((app) => (
            <label
              key={app.packageName}
              htmlFor={`${idPrefix}-${app.packageName}`}
              className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
            >
              <input
                id={`${idPrefix}-${app.packageName}`}
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-border"
                checked={selected.includes(app.packageName)}
                disabled={disabled}
                onChange={() => onToggle(app.packageName)}
              />
              <span className="min-w-0 break-words">{app.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});

/** A labelled switch row sized for touch and safe down to a 320px viewport. */
export const SwitchRow = memo(function SwitchRow({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <label htmlFor={id} className="block break-words text-sm font-medium">
          {label}
        </label>
        {hint}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
});
