'use client';

import { memo, useMemo, useState } from 'react';
import { Archive, CalendarRange, CheckCircle2, Plus, Target } from 'lucide-react';
import GoalFormDialog from '@/components/goals/GoalFormDialog';
import GoalDetailDialog from '@/components/goals/GoalDetailDialog';
import { useGoals } from '@/lib/goalQueries';
import { formatGoalDate } from '@/lib/goalDates';
import { useToast } from '@/components/ui/use-toast';
import type { Goal, GoalStatus } from '@/types/goals';

const FILTERS: Array<{ value: GoalStatus; label: string; icon: typeof Target }> = [
  { value: 'active', label: 'Active', icon: Target },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
  { value: 'archived', label: 'Archived', icon: Archive },
];

const GoalCard = memo(function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: (id: string) => void }) {
  const complete = goal.subGoals.filter((item) => item.completed).length;
  const progress = goal.subGoals.length ? Math.round(complete / goal.subGoals.length * 100) : 0;
  return <li><article className="group rounded-2xl border border-hairline bg-surface p-4 transition-[transform,opacity] duration-200 motion-safe:hover:-translate-y-0.5 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">{goal.gridMode}</span><span className="rounded-full bg-ink/[0.05] px-2 py-1 text-[10px] uppercase tracking-wider text-muted-ink">{goal.completionPolicy}</span></div><h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-ink">{goal.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-ink">{goal.description || 'A focused study goal.'}</p></div><button type="button" onClick={() => onOpen(goal.id)} className="press shrink-0 rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-ink/[0.04]">Details</button></div>
    <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-ink"><span className="flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />{formatGoalDate(goal.startDate)} → {goal.targetDate ? formatGoalDate(goal.targetDate) : 'Open'}</span><span>{complete}/{goal.subGoals.length} plan items</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]" aria-label={`${progress}% plan complete`}><div className="h-full origin-left rounded-full bg-brand transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `scaleX(${progress / 100})` }} /></div>
  </article></li>;
});

export default function Goals() {
  const [status, setStatus] = useState<GoalStatus>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();
  const query = useGoals({ status, limit: 100 });
  const goals = useMemo(() => query.data || [], [query.data]);
  const selected = useMemo(() => goals.find((goal) => goal.id === selectedId) || null, [goals, selectedId]);
  const error = (description: string) => toast({ title: 'Could not update goal', description, variant: 'destructive' });
  return <section className="mx-auto w-full max-w-5xl pb-24 pt-2 sm:pt-6">
    <header className="mb-7 flex items-end justify-between gap-4"><div><p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">Direction and consistency</p><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Goals</h1><p className="mt-1 max-w-xl text-xs text-muted-ink">Turn exam plans into small, repeatable commitments.</p></div><button type="button" onClick={() => setCreateOpen(true)} className="press flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-on-accent"><Plus className="h-4 w-4" />Create<span className="hidden sm:inline"> goal</span></button></header>
    <div className="mb-5 flex gap-1 overflow-x-auto" role="group" aria-label="Goal status filter">{FILTERS.map((item) => { const Icon=item.icon; const active=status===item.value; return <button key={item.value} type="button" aria-pressed={active} onClick={() => { setStatus(item.value); setSelectedId(null); }} className={`press flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium ${active?'bg-ink text-surface':'text-muted-ink hover:bg-ink/[0.04]'}`}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}</div>
    {query.isLoading ? <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading goals">{[0,1,2,3].map((item)=><div key={item} className="h-44 animate-pulse rounded-2xl bg-ink/[0.035] motion-reduce:animate-none" />)}</div> : query.isError ? <Empty title="Could not load goals" copy="Check your connection and try again." action="Try again" onAction={() => void query.refetch()} /> : goals.length ? <ul className="grid gap-3 sm:grid-cols-2">{goals.map((goal)=><GoalCard key={goal.id} goal={goal} onOpen={setSelectedId} />)}</ul> : <Empty title={`No ${status} goals`} copy={status==='active'?'Create a goal from an exam template or start with a blank plan.':'Goals you move here will remain available for review.'} action={status==='active'?'Create your first goal':undefined} onAction={() => setCreateOpen(true)} />}
    <GoalFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => { setStatus('active'); setSelectedId(id); toast({ title: 'Goal created', description: 'Your plan is ready to show up for.' }); }} onError={error} />
    <GoalDetailDialog goal={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onError={error} />
  </section>;
}
function Empty({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction: () => void }) { return <div className="rounded-2xl border border-dashed border-hairline p-10 text-center"><Target className="mx-auto h-8 w-8 text-muted-ink" /><h2 className="mt-3 text-sm font-semibold text-ink">{title}</h2><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-ink">{copy}</p>{action && <button type="button" onClick={onAction} className="press mt-4 rounded-xl border border-hairline px-4 py-2 text-xs font-medium text-ink">{action}</button>}</div>; }
