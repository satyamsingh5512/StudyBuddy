import type { DateKey, Goal, GoalRange } from '@/types/goals';

const DAY_MS = 86_400_000;
export const CALENDAR_WEEKS = 12;
export const MAX_GOAL_RANGE_DAYS = 366;

export const dateKey = (date: Date): DateKey => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: DateKey): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(Number.NaN);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return dateKey(date) === value ? date : new Date(Number.NaN);
};

export const addCalendarDays = (value: DateKey, amount: number): DateKey => {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
};

export const mondayOnOrBefore = (value: DateKey): DateKey => {
  const date = parseDateKey(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateKey(date);
};

export const rangeDays = (range: GoalRange): number => {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY_MS) + 1;
};

export const isValidGoalRange = (range: GoalRange): boolean => {
  const days = rangeDays(range);
  return days >= 1 && days <= MAX_GOAL_RANGE_DAYS;
};

export const calendarRange = (anchor: DateKey = dateKey(new Date())): GoalRange => {
  const week = mondayOnOrBefore(anchor);
  return { from: addCalendarDays(week, -(CALENDAR_WEEKS - 1) * 7), to: addCalendarDays(week, 6) };
};

export const pageCalendarRange = (range: GoalRange, direction: -1 | 1): GoalRange => ({
  from: addCalendarDays(range.from, direction * CALENDAR_WEEKS * 7),
  to: addCalendarDays(range.to, direction * CALENDAR_WEEKS * 7),
});

export const datesInRange = (range: GoalRange): DateKey[] => {
  if (!isValidGoalRange(range)) return [];
  const result: DateKey[] = [];
  for (let current = range.from; current <= range.to; current = addCalendarDays(current, 1)) result.push(current);
  return result;
};

export const rangeContainsDate = (range: GoalRange, value: DateKey): boolean => value >= range.from && value <= range.to;

export const rangeOverlapsWeek = (range: GoalRange, monday: DateKey): boolean =>
  monday <= range.to && addCalendarDays(monday, 6) >= range.from;

export const activityDateForCell = (goal: Goal, cellDate: DateKey): DateKey | null => {
  if (goal.gridMode === 'daily') return cellDate;
  return cellDate === mondayOnOrBefore(cellDate) ? cellDate : null;
};

export const isActivityEligible = (goal: Goal, value: DateKey, today = dateKey(new Date())): boolean => {
  if (goal.status !== 'active' || value < goal.startDate || value > today) return false;
  if (goal.targetDate && value > goal.targetDate) return false;
  return goal.gridMode === 'daily' || value === mondayOnOrBefore(value);
};

export const formatGoalDate = (value: DateKey): string => {
  const date = parseDateKey(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const timezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
