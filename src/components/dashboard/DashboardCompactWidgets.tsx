'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Flag, ListChecks } from 'lucide-react';
import { useGoals } from '@/lib/goalQueries';
import { useBatchShowUps, type BatchShowUpResult } from '@/lib/quickShowUp';
import {
  orderedVisibleDashboardWidgetIds,
  type DashboardWidgetId,
  type NormalizedPreferences,
} from '@/lib/preferences';
import type { User } from '@/store/atoms';
import DashboardWidgetLayout from '@/components/dashboard/DashboardWidgetLayout';

interface Props {
  preferences: NormalizedPreferences;
  user: User | null;
  completedTasks: number;
  totalTasks: number;
  efficiency: number;
  overview: ReactNode;
}

const widgetClass = 'rounded-2xl border border-hairline bg-surface p-5';

export default function DashboardCompactWidgets({ preferences, user, completedTasks, totalTasks, efficiency, overview }: Props) {
  const goalsQuery = useGoals({ status: 'active', limit: 100 });
  const batch = useBatchShowUps();
  const [results, setResults] = useState<BatchShowUpResult[]>([]);
  const goals = useMemo(() => goalsQuery.data || [], [goalsQuery.data]);
  const names = useMemo(() => new Map(goals.map((goal) => [goal.id, goal.title])), [goals]);
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const markAll = async (status: 'complete' | 'partial') => {
    try {
      const response = await batch.mutateAsync({ status, timezone });
      setResults(response.results);
    } catch (error) {
      setResults([{ goalId: 'request', ok: false, error: error instanceof Error ? error.message : 'Request failed' }]);
    }
  };

  const renderers: Partial<Record<DashboardWidgetId, ReactNode>> = {
    overview,
    'daily-summary': <section className={widgetClass}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Daily summary</p><h2 className="mt-1 text-lg font-semibold">{completedTasks} of {totalTasks} tasks done</h2><p className="mt-1 text-xs text-muted-foreground">Today’s efficiency is {Math.round(efficiency)}%.</p></div><ListChecks className="h-5 w-5 text-primary" /></div></section>,
    'quick-show-up': <section className={widgetClass}><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Quick show-up</h2></div><p className="mt-1 text-xs text-muted-foreground">Record today for all active goals in {timezone}.</p></div><div className="flex gap-2"><button type="button" disabled={batch.isPending || goalsQuery.isLoading || goals.length === 0} onClick={() => void markAll('partial')} className="rounded-xl border border-hairline px-3 py-2 text-xs font-medium disabled:opacity-50">Partial</button><button type="button" disabled={batch.isPending || goalsQuery.isLoading || goals.length === 0} onClick={() => void markAll('complete')} className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Complete</button></div></div>{results.length > 0 && <ul className="mt-3 space-y-1 border-t border-hairline pt-3 text-xs" aria-live="polite">{results.map((result, index) => <li key={`${result.goalId}-${index}`} className={result.ok ? 'text-success' : 'text-destructive'}>{names.get(result.goalId) || (result.goalId === 'request' ? 'Batch request' : result.goalId)}: {result.ok ? `saved for ${result.date}` : result.error || 'not saved'}</li>)}</ul>}</section>,
  };

  return (
    <DashboardWidgetLayout
      orderedVisibleIds={orderedVisibleDashboardWidgetIds(preferences)}
      renderers={renderers}
    />
  );
}
