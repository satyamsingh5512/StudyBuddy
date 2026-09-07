export interface AnalyticsDay {
  date: string;
  studyHours: number;
  tasksCompleted: number;
  sessions: number;
  understanding: number;
}

export interface AnalyticsExplanation {
  totalHours: number;
  totalTasks: number;
  averageHours: number;
  activeDays: number;
  productiveDate: string | null;
  trend: 'up' | 'down' | 'steady' | 'insufficient-data';
  summary: string;
  method: string;
}

const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Explains—not predicts—what the recorded timer/task data says. It avoids
 * invented targets or causal claims, and makes sparse data explicit.
 */
export function explainAnalytics(days: readonly AnalyticsDay[]): AnalyticsExplanation {
  const normalized = days.map((day) => ({
    ...day,
    studyHours: Math.max(0, finite(day.studyHours)),
    tasksCompleted: Math.max(0, Math.round(finite(day.tasksCompleted))),
    sessions: Math.max(0, Math.round(finite(day.sessions))),
    understanding: Math.max(0, Math.min(10, finite(day.understanding))),
  }));
  const totalHours = normalized.reduce((sum, day) => sum + day.studyHours, 0);
  const totalTasks = normalized.reduce((sum, day) => sum + day.tasksCompleted, 0);
  const activeDays = normalized.filter((day) => day.studyHours > 0 || day.tasksCompleted > 0).length;
  const productive = normalized.reduce<AnalyticsDay | null>(
    (best, day) => (!best || day.studyHours > best.studyHours ? day : best),
    null
  );

  let trend: AnalyticsExplanation['trend'] = 'insufficient-data';
  if (normalized.length >= 4) {
    const split = Math.floor(normalized.length / 2);
    const first = normalized.slice(0, split);
    const second = normalized.slice(split);
    const firstAverage = first.reduce((sum, day) => sum + day.studyHours, 0) / first.length;
    const secondAverage = second.reduce((sum, day) => sum + day.studyHours, 0) / second.length;
    const delta = secondAverage - firstAverage;
    trend = Math.abs(delta) < 0.15 ? 'steady' : delta > 0 ? 'up' : 'down';
  }

  const trendText = {
    up: 'The latter half of this range has more recorded study time than the first half.',
    down: 'The latter half of this range has less recorded study time than the first half.',
    steady: 'Recorded study time is broadly steady across the two halves of this range.',
    'insufficient-data': 'There are not enough days in this range to compare the first and second halves.',
  }[trend];

  const summary = activeDays === 0
    ? 'No timer sessions or completed tasks were recorded in this range yet.'
    : `${totalHours.toFixed(1)} recorded study hours across ${activeDays} active day${activeDays === 1 ? '' : 's'} and ${totalTasks} completed task${totalTasks === 1 ? '' : 's'}. ${trendText}`;

  return {
    totalHours,
    totalTasks,
    averageHours: normalized.length ? totalHours / normalized.length : 0,
    activeDays,
    productiveDate: productive && productive.studyHours > 0 ? productive.date : null,
    trend,
    summary,
    method: 'Study time comes from saved timer sessions. Completed tasks use their completion time when available; older records use their scheduled date. Values are grouped in your selected timezone.',
  };
}
