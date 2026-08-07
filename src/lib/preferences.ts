import { ACCENT_IDS, type AccentPreference, type UserPreferences } from '@/types/content';

export type { AccentPreference } from '@/types/content';

export const FONT_OPTIONS = ['sans', 'mono', 'serif'] as const;
export type FontPreference = (typeof FONT_OPTIONS)[number];

const ACCENT_LABELS: Record<AccentPreference, string> = {
  blue: 'Blue',
  violet: 'Violet',
  teal: 'Teal',
  green: 'Green',
  orange: 'Orange',
  rose: 'Rose',
  purple: 'Purple',
  indigo: 'Indigo',
  cyan: 'Cyan',
  lime: 'Lime',
  yellow: 'Yellow',
  amber: 'Amber',
  red: 'Red',
  pink: 'Pink',
};

export const ACCENT_OPTIONS = ACCENT_IDS.map((id) => ({ id, label: ACCENT_LABELS[id] }));

// Only top-level sections that can independently move and disappear belong in
// this registry. The floating timer, analytics toggle, and combined task / activity
// workspace remain fixed dashboard features and are intentionally not advertised.
export const DASHBOARD_WIDGETS = [
  { id: 'overview', label: 'Overview', description: 'Today’s task, efficiency, points, and streak totals.' },
  { id: 'goals', label: 'Goals link', description: 'Quick access to active goals.' },
  { id: 'schedule', label: 'Schedule link', description: 'Quick access to today’s schedule.' },
  { id: 'leaderboard', label: 'Leaderboard link', description: 'Quick access to peer standings.' },
  { id: 'daily-summary', label: 'Daily summary', description: 'A compact summary of today’s tasks and efficiency.' },
  { id: 'weekly-check-in', label: 'Weekly check-in', description: 'Link to goal momentum and weekly reflection.' },
  { id: 'achievements', label: 'Achievements preview', description: 'Recent badge and milestone progress.' },
  { id: 'quick-show-up', label: 'Quick show-up', description: 'Mark all active goals complete or partial for today.' },
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];
export const DASHBOARD_WIDGET_IDS = DASHBOARD_WIDGETS.map((widget) => widget.id) as DashboardWidgetId[];

export interface NormalizedPreferences {
  font: FontPreference;
  accent: AccentPreference;
  dashboard: { order: DashboardWidgetId[]; hidden: DashboardWidgetId[] };
  showUpReminder: { enabled: boolean; time: string; days: number[] };
  mentorJournalContext: boolean;
}

const uniqueAllowed = <T extends string>(values: unknown, allowed: readonly T[]): T[] => {
  if (!Array.isArray(values)) return [];
  const allow = new Set<string>(allowed);
  return [...new Set(values.filter((value): value is T => typeof value === 'string' && allow.has(value)))];
};

export const normalizeDashboardPreferences = (
  dashboard?: UserPreferences['dashboard']
): NormalizedPreferences['dashboard'] => {
  const suppliedOrder = uniqueAllowed(dashboard?.order, DASHBOARD_WIDGET_IDS);
  const order = [...suppliedOrder, ...DASHBOARD_WIDGET_IDS.filter((id) => !suppliedOrder.includes(id))];
  return { order, hidden: uniqueAllowed(dashboard?.hidden, DASHBOARD_WIDGET_IDS) };
};

export const normalizePreferences = (preferences?: UserPreferences): NormalizedPreferences => {
  const font = FONT_OPTIONS.includes(preferences?.font as FontPreference)
    ? (preferences?.font as FontPreference)
    : 'sans';
  const accentIds = ACCENT_OPTIONS.map((option) => option.id);
  const accent = accentIds.includes(preferences?.accent as AccentPreference)
    ? (preferences?.accent as AccentPreference)
    : 'blue';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(preferences?.showUpReminder?.time || '')
    ? preferences!.showUpReminder!.time
    : '20:00';
  const days = Array.isArray(preferences?.showUpReminder?.days)
    ? [...new Set(preferences.showUpReminder.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [];
  return {
    font,
    accent,
    dashboard: normalizeDashboardPreferences(preferences?.dashboard),
    showUpReminder: {
      enabled: Boolean(preferences?.showUpReminder?.enabled),
      time,
      days,
    },
    mentorJournalContext: Boolean(preferences?.mentorJournalContext),
  };
};

export const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return Boolean(value.trim());
  } catch {
    return false;
  }
};

export const APPEARANCE_STORAGE_KEY = 'studybuddy_appearance';
interface AppearanceRoot { dataset: DOMStringMap }
interface AppearanceStorage { setItem(key: string, value: string): void }

export const applyAppearancePreferences = (
  preferences?: Pick<UserPreferences, 'font' | 'accent'>,
  root: AppearanceRoot | null = typeof document === 'undefined' ? null : document.documentElement,
  storage: AppearanceStorage | null = typeof localStorage === 'undefined' ? null : localStorage
): { font: FontPreference; accent: AccentPreference } => {
  const normalized = normalizePreferences(preferences);
  if (root) {
    root.dataset.font = normalized.font;
    root.dataset.accent = normalized.accent;
  }
  try {
    storage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ font: normalized.font, accent: normalized.accent }));
  } catch {
    // Appearance still applies when storage is unavailable.
  }
  return { font: normalized.font, accent: normalized.accent };
};

export const widgetOrderIndex = (preferences: NormalizedPreferences, id: DashboardWidgetId): number =>
  preferences.dashboard.order.indexOf(id);
export const widgetIsVisible = (preferences: NormalizedPreferences, id: DashboardWidgetId): boolean =>
  !preferences.dashboard.hidden.includes(id);

export const orderedVisibleDashboardWidgetIds = (
  preferences: NormalizedPreferences
): DashboardWidgetId[] => preferences.dashboard.order.filter(
  (id) => !preferences.dashboard.hidden.includes(id)
);
