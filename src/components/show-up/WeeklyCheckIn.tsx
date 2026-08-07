'use client';

import { useEffect, useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { addCalendarDays, dateKey, mondayOnOrBefore, rangeContainsDate } from '@/lib/goalDates';
import { usePutGoalCheckIn } from '@/lib/goalQueries';
import type { Goal, GoalCheckIn, GoalRange } from '@/types/goals';

export default function WeeklyCheckIn({goal,range,checkIns,onError}:{goal:Goal;range:GoalRange;checkIns:GoalCheckIn[];onError:(message:string)=>void}) {
  const today=dateKey(new Date()); const weekStart=useMemo(()=>{const visible=mondayOnOrBefore(range.to<today?range.to:today);return rangeContainsDate(range,visible)?visible:mondayOnOrBefore(range.from);},[range,today]);
  const existing=checkIns.find(item=>item.weekStart===weekStart); const [target,setTarget]=useState(75); const [reflection,setReflection]=useState(''); const mutation=usePutGoalCheckIn(goal.id);
  useEffect(()=>{setTarget(existing?.targetMomentum??75);setReflection(existing?.reflection??'');},[existing?.id,existing?.targetMomentum,existing?.reflection,weekStart]);
  const eligible=goal.status==='active'&&weekStart<=mondayOnOrBefore(today)&&weekStart<= (goal.targetDate||weekStart)&&addCalendarDays(weekStart,6)>=goal.startDate;
  const save=async()=>{try{await mutation.mutateAsync({weekStart,input:{targetMomentum:target,reflection:reflection.trim()}});}catch(e){onError(e instanceof Error?e.message:'Check-in was not saved.');}};
  return <section className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-ink">Weekly momentum check-in</h2><p className="mt-1 text-xs text-muted-ink">Week of {weekStart}</p></div><span className="rounded-lg bg-brand/10 px-2 py-1 text-sm font-semibold text-brand">{target}%</span></div><label className="mt-5 block text-xs text-muted-ink" htmlFor="momentum-target">Target momentum</label><Slider id="momentum-target" aria-label="Target momentum" value={target} min={0} max={100} step={5} onChange={setTarget} disabled={!eligible} className="mt-3" /><label className="mt-5 block text-xs text-muted-ink" htmlFor="momentum-reflection">Reflection (optional)</label><Textarea id="momentum-reflection" value={reflection} maxLength={5000} disabled={!eligible} onChange={(e)=>setReflection(e.target.value)} placeholder="What helped you show up this week?" className="mt-2 rounded-xl border-hairline bg-surface" /><button type="button" disabled={!eligible||mutation.isPending} onClick={()=>void save()} className="press mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40">{mutation.isPending?'Saving…':existing?'Update check-in':'Save check-in'}</button>{!eligible&&<p className="mt-2 text-[10px] text-muted-ink">This week is outside the active goal timeline.</p>}</section>;
}
