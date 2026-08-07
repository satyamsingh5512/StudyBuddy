'use client';

import { memo, useMemo } from 'react';
import { Check, Circle, Minus } from 'lucide-react';
import { activityDateForCell, dateKey, datesInRange, formatGoalDate, isActivityEligible } from '@/lib/goalDates';
import type { DateKey, Goal, GoalRange, ShowUp } from '@/types/goals';

const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
interface Props { goal: Goal; range: GoalRange; showUps: ShowUp[]; selected?: DateKey | null; onSelect: (date: DateKey) => void }

export default function ShowUpCalendar({ goal, range, showUps, selected, onSelect }: Props) {
  const days = useMemo(() => datesInRange(range), [range]);
  const statuses = useMemo(() => new Map(showUps.map((entry) => [entry.date, entry])), [showUps]);
  return <div role="region" aria-label="Show-up calendar" tabIndex={0} className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain rounded-2xl border border-hairline bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 sm:p-4">
    <div className="min-w-[560px]"><div className="mb-2 grid grid-cols-7 gap-1">{WEEKDAYS.map((day)=><div key={day} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-ink">{day}</div>)}</div><div className="grid grid-cols-7 gap-1.5">{days.map((cell) => { const period=activityDateForCell(goal,cell); const eligible=Boolean(period && isActivityEligible(goal,period)); const entry=period ? statuses.get(period) : undefined; return <DayCell key={cell} date={cell} period={period} entry={entry} eligible={eligible} selected={selected===period} onSelect={onSelect} />; })}</div></div>
    <div className="mt-4 flex flex-wrap gap-3 border-t border-hairline pt-3 text-[10px] text-muted-ink"><Legend icon={<Circle className="h-3 w-3" />} text="Not marked" /><Legend icon={<Minus className="h-3 w-3" />} text="Partial" /><Legend icon={<Check className="h-3 w-3" />} text="Complete" /><span>Outlined: marked by you · Filled: from checklist</span></div>
  </div>;
}
const DayCell = memo(function DayCell({ date, period, entry, eligible, selected, onSelect }: { date:DateKey; period:DateKey|null; entry?:ShowUp; eligible:boolean; selected:boolean; onSelect:(date:DateKey)=>void }) {
  const today=dateKey(new Date()); const status=entry?.status || 'none'; const source=entry?.source;
  const visual = status==='complete' ? source==='manual'?'border-brand text-brand bg-surface':'border-brand bg-brand text-on-accent' : status==='partial' ? source==='manual'?'border-warning text-warning bg-surface':'border-warning bg-warning/20 text-ink' : 'border-hairline text-muted-ink';
  const label = period ? `${formatGoalDate(period)}: ${status === 'none' ? 'not marked' : status}, ${source === 'manual' ? 'marked by you' : source === 'automatic' ? 'from checklist' : ''}` : `${formatGoalDate(date)}: weekly continuation`;
  return <button type="button" disabled={!eligible} aria-label={label} aria-pressed={selected} onClick={() => period && onSelect(period)} className={`press relative flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-30 ${visual} ${selected?'ring-2 ring-brand/40':''}`}><span className="font-semibold">{Number(date.slice(8))}</span>{status==='complete'?<Check className="h-3 w-3" />:status==='partial'?<Minus className="h-3 w-3" />:<span className="h-3" />}{date===today&&<span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-current" />}</button>;
});
function Legend({icon,text}:{icon:React.ReactNode;text:string}) { return <span className="flex items-center gap-1">{icon}{text}</span>; }
