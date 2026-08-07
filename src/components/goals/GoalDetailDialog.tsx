'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Archive, Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAddMilestone, useAddSubGoal, useDeleteGoal, useDeleteMilestone, useDeleteSubGoal, useGoalLifecycle, usePatchGoal, useReorderMilestones, useReorderSubGoals, useUpdateMilestone, useUpdateSubGoal } from '@/lib/goalQueries';
import { formatGoalDate } from '@/lib/goalDates';
import type { Goal, Milestone, SubGoal } from '@/types/goals';

interface Props { goal: Goal | null; open: boolean; onOpenChange: (open: boolean) => void; onError: (message: string) => void }
type Section = 'overview' | 'plan' | 'settings';
const SECTIONS: Section[] = ['overview', 'plan', 'settings'];
const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, current: Section, goalId: string, select: (section: Section) => void) => {
  const index = SECTIONS.indexOf(current);
  let next: Section | undefined;
  if (event.key === 'ArrowRight') next = SECTIONS[(index + 1) % SECTIONS.length];
  if (event.key === 'ArrowLeft') next = SECTIONS[(index - 1 + SECTIONS.length) % SECTIONS.length];
  if (event.key === 'Home') next = SECTIONS[0];
  if (event.key === 'End') next = SECTIONS[SECTIONS.length - 1];
  if (!next) return;
  event.preventDefault();
  select(next);
  requestAnimationFrame(() => document.getElementById(`goal-${goalId}-tab-${next}`)?.focus());
};
const secondary = 'press rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-ink/[0.04] disabled:opacity-40';

export default function GoalDetailDialog({ goal, open, onOpenChange, onError }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(''); const [targetDate, setTargetDate] = useState<string | null>(null);
  const [gridMode, setGridMode] = useState<Goal['gridMode']>('daily'); const [completionPolicy, setCompletionPolicy] = useState<Goal['completionPolicy']>('manual');
  const [confirm, setConfirm] = useState('');
  const id = goal?.id || '';
  const patch = usePatchGoal(id); const lifecycle = useGoalLifecycle(id); const remove = useDeleteGoal();
  useEffect(() => { if (!goal) return; setTitle(goal.title); setDescription(goal.description || ''); setStartDate(goal.startDate); setTargetDate(goal.targetDate ?? null); setGridMode(goal.gridMode); setCompletionPolicy(goal.completionPolicy); setConfirm(''); setSection('overview'); }, [goal]);
  if (!goal) return null;
  const act = async (action: 'complete'|'archive'|'restore') => { try { await lifecycle.mutateAsync(action); } catch (e) { onError(e instanceof Error ? e.message : 'Goal was not updated.'); } };
  const save = async () => { try { await patch.mutateAsync({ title: title.trim(), description: description.trim(), startDate, targetDate, gridMode, completionPolicy }); } catch (e) { onError(e instanceof Error ? e.message : 'Settings were not saved.'); } };
  const destroy = async () => { try { await remove.mutateAsync(goal.id); onOpenChange(false); } catch (e) { onError(e instanceof Error ? e.message : 'Goal was not deleted.'); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl">
    <DialogHeader><DialogTitle>{goal.title}</DialogTitle><DialogDescription>{goal.gridMode === 'daily' ? 'Daily' : 'Weekly'} · {goal.completionPolicy === 'auto' ? 'Automatic plan completion' : 'Manual plan completion'} · {goal.status}</DialogDescription></DialogHeader>
    <div role="tablist" aria-label="Goal details" className="flex gap-1 border-b border-hairline">{SECTIONS.map((item) => <button key={item} id={`goal-${goal.id}-tab-${item}`} type="button" role="tab" aria-selected={section === item} aria-controls={`goal-${goal.id}-panel-${item}`} tabIndex={section === item ? 0 : -1} onClick={() => setSection(item)} onKeyDown={(event) => handleTabKey(event, item, goal.id, setSection)} className={`press border-b-2 px-3 py-2 text-xs capitalize ${section === item ? 'border-brand text-ink' : 'border-transparent text-muted-ink'}`}>{item}</button>)}</div>
    {section === 'overview' && <div id={`goal-${goal.id}-panel-overview`} role="tabpanel" aria-labelledby={`goal-${goal.id}-tab-overview`} tabIndex={0} className="space-y-5"><p className="text-sm leading-6 text-muted-ink">{goal.description || 'No description yet.'}</p><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Starts" value={formatGoalDate(goal.startDate)} /><Stat label="Target" value={goal.targetDate ? formatGoalDate(goal.targetDate) : 'Open-ended'} /><Stat label="Sub-goals" value={`${goal.subGoals.filter(x => x.completed).length}/${goal.subGoals.length}`} /><Stat label="Milestones" value={`${goal.milestones.filter(x => x.completed).length}/${goal.milestones.length}`} /></dl><div className="flex flex-wrap gap-2">{goal.status === 'active' && goal.completionPolicy === 'manual' && <button className={secondary} onClick={() => void act('complete')}><Check className="mr-1 inline h-4 w-4" />Complete goal</button>}{goal.status !== 'archived' && <button className={secondary} onClick={() => void act('archive')}><Archive className="mr-1 inline h-4 w-4" />Archive</button>}{goal.status === 'archived' && <button className={secondary} onClick={() => void act('restore')}><RotateCcw className="mr-1 inline h-4 w-4" />Restore</button>}</div></div>}
    {section === 'plan' && <div id={`goal-${goal.id}-panel-plan`} role="tabpanel" aria-labelledby={`goal-${goal.id}-tab-plan`} tabIndex={0}><PlanEditor goal={goal} onError={onError} /></div>}
    {section === 'settings' && <div id={`goal-${goal.id}-panel-settings`} role="tabpanel" aria-labelledby={`goal-${goal.id}-tab-settings`} tabIndex={0} className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-xs text-muted-ink">Title</span><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs text-muted-ink">Description</span><Textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} /></label><label><span className="mb-1 block text-xs text-muted-ink">Start</span><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><div><label className="flex items-center gap-2 text-xs text-muted-ink"><input type="checkbox" checked={targetDate === null} onChange={(e) => setTargetDate(e.target.checked ? null : startDate)} />Open-ended</label>{targetDate !== null && <Input className="mt-1" aria-label="Target date" type="date" min={startDate} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}</div><fieldset><legend className="mb-1 text-xs text-muted-ink">Calendar cadence</legend><div className="flex gap-1">{(['daily','weekly'] as const).map((mode) => <button key={mode} type="button" aria-pressed={gridMode === mode} onClick={() => setGridMode(mode)} className={`press flex-1 rounded-xl px-3 py-2 text-xs capitalize ${gridMode === mode ? 'bg-ink text-surface' : 'border border-hairline'}`}>{mode}</button>)}</div></fieldset><fieldset><legend className="mb-1 text-xs text-muted-ink">Goal completion</legend><div className="flex gap-1">{(['auto','manual'] as const).map((policy) => <button key={policy} type="button" aria-pressed={completionPolicy === policy} onClick={() => setCompletionPolicy(policy)} className={`press flex-1 rounded-xl px-3 py-2 text-xs capitalize ${completionPolicy === policy ? 'bg-ink text-surface' : 'border border-hairline'}`}>{policy}</button>)}</div></fieldset></div><button type="button" disabled={!title.trim() || patch.isPending} onClick={() => void save()} className="press rounded-xl bg-brand px-4 py-2 text-sm text-on-accent disabled:opacity-40">Save settings</button><section className="rounded-2xl border border-destructive/30 p-4"><h3 className="font-semibold text-destructive">Delete goal</h3><p className="mt-1 text-xs text-muted-ink">Permanently removes this goal and all checklist, show-up, and check-in history. Type <strong>{goal.title}</strong> to confirm.</p><Input className="mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type goal title to confirm deletion" /><button type="button" disabled={confirm !== goal.title || remove.isPending} onClick={() => void destroy()} className="press mt-3 rounded-xl bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-35"><Trash2 className="mr-1 inline h-4 w-4" />Delete permanently</button></section></div>}
  </DialogContent></Dialog>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-hairline bg-surface p-3"><dt className="text-[10px] uppercase tracking-wider text-muted-ink">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{value}</dd></div>; }

function PlanEditor({ goal, onError }: { goal: Goal; onError: (message: string) => void }) {
  const [subTitle, setSubTitle] = useState(''); const [milestoneTitle, setMilestoneTitle] = useState(''); const [milestoneDate, setMilestoneDate] = useState('');
  const addSub = useAddSubGoal(goal.id), updateSub = useUpdateSubGoal(goal.id), deleteSub = useDeleteSubGoal(goal.id), reorderSub = useReorderSubGoals(goal.id);
  const addMilestone = useAddMilestone(goal.id), updateMilestone = useUpdateMilestone(goal.id), deleteMilestone = useDeleteMilestone(goal.id), reorderMilestone = useReorderMilestones(goal.id);
  const attempt = async (task: () => Promise<unknown>) => { try { await task(); } catch (e) { onError(e instanceof Error ? e.message : 'Plan was not updated.'); } };
  const reorder = (items: Array<SubGoal|Milestone>, index: number, direction: -1|1, mutation: typeof reorderSub) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index],next[target]]=[next[target],next[index]]; void attempt(() => mutation.mutateAsync({ orderedIds: next.map(x => x.id) })); };
  return <div className="space-y-6"><p className="rounded-xl bg-warning/10 p-3 text-xs text-muted-ink">Plan completion is different from the daily Show Up checklist. Changing sub-goals updates the plan definition and incompatible checklist history is reset by the server.</p><ItemSection title="Sub-goals" value={subTitle} setValue={setSubTitle} onAdd={() => attempt(async () => { await addSub.mutateAsync({ title: subTitle.trim() }); setSubTitle(''); })}>{goal.subGoals.map((item,index) => <PlanRow key={item.id} item={item} index={index} count={goal.subGoals.length} onToggle={() => attempt(() => updateSub.mutateAsync({ subGoalId: item.id, input: { completed: !item.completed } }))} onRename={(title) => attempt(() => updateSub.mutateAsync({ subGoalId: item.id, input: { title } }))} onDelete={() => attempt(() => deleteSub.mutateAsync(item.id))} onMove={(d) => reorder(goal.subGoals,index,d,reorderSub)} />)}</ItemSection><ItemSection title="Milestones" value={milestoneTitle} setValue={setMilestoneTitle} onAdd={() => attempt(async () => { await addMilestone.mutateAsync({ title: milestoneTitle.trim(), targetDate: milestoneDate || null }); setMilestoneTitle(''); setMilestoneDate(''); })} extra={<Input aria-label="New milestone target date" type="date" min={goal.startDate} max={goal.targetDate || undefined} value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} className="h-10 sm:w-40" />}>{goal.milestones.map((item,index) => <PlanRow key={item.id} item={item} index={index} count={goal.milestones.length} targetDate={item.targetDate ?? null} minDate={goal.startDate} maxDate={goal.targetDate ?? undefined} onTargetDateChange={(targetDate) => attempt(() => updateMilestone.mutateAsync({ milestoneId: item.id, input: { targetDate } }))} onToggle={() => attempt(() => updateMilestone.mutateAsync({ milestoneId: item.id, input: { completed: !item.completed } }))} onRename={(title) => attempt(() => updateMilestone.mutateAsync({ milestoneId: item.id, input: { title } }))} onDelete={() => attempt(() => deleteMilestone.mutateAsync(item.id))} onMove={(d) => reorder(goal.milestones,index,d,reorderMilestone as typeof reorderSub)} />)}</ItemSection></div>;
}
function ItemSection({ title, value, setValue, onAdd, extra, children }: { title: string; value: string; setValue: (v:string)=>void; onAdd:()=>void; extra?: React.ReactNode; children: React.ReactNode }) { return <section><h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3><div className="mb-3 flex flex-wrap gap-2"><Input aria-label={`New ${title}`} value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} className="h-10 min-w-48 flex-1" />{extra}<button type="button" disabled={!value.trim()} onClick={onAdd} className={secondary}><Plus className="mr-1 inline h-4 w-4" />Add</button></div><ol className="space-y-2">{children}</ol></section>; }
function PlanRow({ item, index, count, targetDate, minDate, maxDate, onTargetDateChange, onToggle, onRename, onDelete, onMove }: {
  item: SubGoal | Milestone;
  index: number;
  count: number;
  targetDate?: string | null;
  minDate?: string;
  maxDate?: string;
  onTargetDateChange?: (targetDate: string | null) => void;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);
  return <li className="flex flex-wrap items-start gap-1 rounded-xl border border-hairline p-2">
    <button type="button" aria-label={`${item.completed ? 'Reopen' : 'Mark'} ${item.title} plan complete`} onClick={onToggle} className={`press grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${item.completed ? 'border-brand bg-brand text-on-accent' : 'border-hairline'}`}>{item.completed && <Check className="h-4 w-4" />}</button>
    <div className="min-w-44 flex-1">
      {editing ? <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim() && title.trim() !== item.title) onRename(title.trim()); setEditing(false); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="h-9 w-full" /> : <button type="button" onClick={() => setEditing(true)} className={`h-9 w-full truncate px-2 text-left text-sm ${item.completed ? 'text-muted-ink line-through' : 'text-ink'}`}>{item.title}</button>}
      {onTargetDateChange && <div className="mt-1 flex flex-wrap items-center gap-2 px-2"><label className="flex items-center gap-2 text-[10px] text-muted-ink"><span>Target date</span><Input aria-label={`${item.title} target date`} type="date" min={minDate} max={maxDate} value={targetDate || ''} onChange={(event) => onTargetDateChange(event.target.value || null)} className="h-9 w-40" /></label><button type="button" disabled={!targetDate} onClick={() => onTargetDateChange(null)} className="press rounded-lg px-2 py-1 text-[10px] text-muted-ink disabled:opacity-35">Clear date</button></div>}
    </div>
    <div className="ml-auto flex shrink-0">
      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="grid h-9 w-9 place-items-center disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
      <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className="grid h-9 w-9 place-items-center disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
      <button type="button" aria-label={`Delete ${item.title}`} onClick={onDelete} className="grid h-9 w-9 place-items-center text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  </li>;
}
