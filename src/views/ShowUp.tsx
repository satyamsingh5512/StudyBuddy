'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { Link } from '@/lib/router';
import ShowUpCalendar from '@/components/show-up/ShowUpCalendar';
import DailyChecklistDialog from '@/components/show-up/DailyChecklistDialog';
import MomentumStats from '@/components/show-up/MomentumStats';
import WeeklyCheckIn from '@/components/show-up/WeeklyCheckIn';
import { calendarRange, dateKey, formatGoalDate, pageCalendarRange } from '@/lib/goalDates';
import { useGoalCheckIns, useGoalCompletions, useGoals, useGoalShowUps, useGoalStats } from '@/lib/goalQueries';
import { useToast } from '@/components/ui/use-toast';
import type { DateKey, GoalRange } from '@/types/goals';

export default function ShowUp() {
  const goalsQuery=useGoals({status:'active',limit:100}); const goals=useMemo(()=>goalsQuery.data||[],[goalsQuery.data]);
  const [goalId,setGoalId]=useState(''); const [range,setRange]=useState<GoalRange>(()=>calendarRange()); const [selectedDate,setSelectedDate]=useState<DateKey|null>(null); const {toast}=useToast();
  useEffect(()=>{if(!goals.length){setGoalId('');return;}if(!goals.some(goal=>goal.id===goalId))setGoalId(goals[0].id);},[goals,goalId]);
  const goal=useMemo(()=>goals.find(item=>item.id===goalId),[goals,goalId]);
  const completions=useGoalCompletions(goalId||undefined,range), showUps=useGoalShowUps(goalId||undefined,range), stats=useGoalStats(goalId||undefined,range), checkIns=useGoalCheckIns(goalId||undefined,range);
  const onError=(description:string)=>toast({title:'Could not save activity',description,variant:'destructive'});
  const changeRange=(direction:-1|1)=>{setRange(value=>pageCalendarRange(value,direction));setSelectedDate(null);};
  const currentRange=calendarRange(dateKey(new Date())); const canNext=range.to<currentRange.to;
  if(goalsQuery.isLoading)return <section className="mx-auto w-full max-w-6xl pt-6"><div className="h-36 animate-pulse rounded-2xl bg-ink/[0.035] motion-reduce:animate-none" /></section>;
  if(goalsQuery.isError)return <section className="mx-auto w-full max-w-6xl pt-6"><Empty title="Could not load your goals" copy="Try again when your connection is ready." action="Try again" onAction={()=>void goalsQuery.refetch()} /></section>;
  if(!goals.length)return <section className="mx-auto w-full max-w-6xl pb-24 pt-6"><header className="mb-8"><p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">Consistency calendar</p><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Show Up</h1></header><Empty title="Create an active goal first" copy="Show Up turns an active goal into a daily or weekly consistency calendar." action="Go to Goals" href="/goals" /></section>;
  if(!goal)return null;
  const activityError=completions.isError||showUps.isError||stats.isError||checkIns.isError;
  return <section className="mx-auto w-full max-w-6xl pb-24 pt-2 sm:pt-6"><header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">Consistency calendar</p><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Show Up</h1><p className="mt-1 text-xs text-muted-ink">Small commitments build exam momentum.</p></div><label className="min-w-64"><span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-ink">Active goal</span><select value={goalId} onChange={(e)=>{setGoalId(e.target.value);setSelectedDate(null);}} className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">{goals.map(item=><option key={item.id} value={item.id}>{item.title} · {item.gridMode}</option>)}</select></label></header>
    <MomentumStats stats={stats.data} loading={stats.isLoading} cadence={goal.gridMode} />
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><div><div className="mb-2 flex items-center justify-between gap-3"><button type="button" onClick={()=>changeRange(-1)} aria-label="Previous twelve weeks" className="press grid h-10 w-10 place-items-center rounded-xl border border-hairline"><ChevronLeft className="h-4 w-4" /></button><div className="text-center"><h2 className="text-sm font-semibold text-ink">{formatGoalDate(range.from)} – {formatGoalDate(range.to)}</h2><p className="text-[10px] text-muted-ink">12-week view · Monday to Sunday</p></div><button type="button" disabled={!canNext} onClick={()=>changeRange(1)} aria-label="Next twelve weeks" className="press grid h-10 w-10 place-items-center rounded-xl border border-hairline disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button></div>{activityError?<div className="rounded-2xl border border-destructive/30 p-8 text-center"><p className="text-sm text-ink">Some calendar data could not load.</p><button type="button" onClick={()=>{void completions.refetch();void showUps.refetch();void stats.refetch();void checkIns.refetch();}} className="mt-3 text-xs text-brand hover:underline">Try again</button></div>:<ShowUpCalendar goal={goal} range={range} showUps={showUps.data||[]} selected={selectedDate} onSelect={setSelectedDate} />}</div><WeeklyCheckIn goal={goal} range={range} checkIns={checkIns.data||[]} onError={onError} /></div>
    <DailyChecklistDialog goal={goal} date={selectedDate} completions={completions.data||[]} showUps={showUps.data||[]} onOpenChange={(open)=>{if(!open)setSelectedDate(null);}} onError={onError} />
  </section>;
}
function Empty({title,copy,action,onAction,href}:{title:string;copy:string;action:string;onAction?:()=>void;href?:string}){return <div className="rounded-2xl border border-dashed border-hairline p-10 text-center"><Target className="mx-auto h-8 w-8 text-muted-ink" /><h2 className="mt-3 text-sm font-semibold text-ink">{title}</h2><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-ink">{copy}</p>{href?<Link to={href} className="press mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-xs font-medium text-on-accent">{action}</Link>:<button type="button" onClick={onAction} className="press mt-4 rounded-xl border border-hairline px-4 py-2 text-xs font-medium text-ink">{action}</button>}</div>}
