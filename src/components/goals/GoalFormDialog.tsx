'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GOAL_TEMPLATES, templateToGoal } from '@/lib/goalTemplates';
import { useCreateGoal } from '@/lib/goalQueries';
import type { CreateGoalInput, GoalMilestoneInput, GoalSubGoalInput } from '@/types/goals';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (id: string) => void; onError: (message: string) => void }
const field = 'rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20';

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function GoalFormDialog({ open, onOpenChange, onCreated, onError }: Props) {
  const [draft, setDraft] = useState<CreateGoalInput>(() => templateToGoal(GOAL_TEMPLATES[5]));
  const [selected, setSelected] = useState('custom');
  const create = useCreateGoal();
  useEffect(() => { if (!open) return; setSelected('custom'); setDraft(templateToGoal(GOAL_TEMPLATES[5])); }, [open]);
  const validation = useMemo(() => {
    if (!draft.title.trim()) return 'Add a goal title.';
    if (draft.title.trim().length > 200) return 'Title must be 200 characters or fewer.';
    if (draft.description.length > 2000) return 'Description must be 2,000 characters or fewer.';
    if (!draft.startDate) return 'Choose a start date.';
    if (draft.targetDate && draft.targetDate < draft.startDate) return 'Target date cannot be before the start date.';
    if (draft.completionPolicy === 'auto' && draft.subGoals.length === 0) return 'Automatic goals need at least one sub-goal.';
    if (draft.subGoals.some((item) => !item.title.trim())) return 'Every sub-goal needs a title.';
    if (draft.milestones.some((item) => !item.title.trim())) return 'Every milestone needs a title.';
    if (draft.milestones.some((item) => item.targetDate && (item.targetDate < draft.startDate || Boolean(draft.targetDate && item.targetDate > draft.targetDate)))) return 'Milestone dates must be inside the goal timeline.';
    return '';
  }, [draft]);
  const updateSub = (index: number, patch: Partial<GoalSubGoalInput>) => setDraft((value) => ({ ...value, subGoals: value.subGoals.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const updateMilestone = (index: number, patch: Partial<GoalMilestoneInput>) => setDraft((value) => ({ ...value, milestones: value.milestones.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const submit = async () => {
    if (validation || create.isPending) return;
    try {
      const goal = await create.mutateAsync({ ...draft, title: draft.title.trim(), description: draft.description.trim(), subGoals: draft.subGoals.map((item) => ({ ...item, title: item.title.trim() })), milestones: draft.milestones.map((item) => ({ ...item, title: item.title.trim(), targetDate: item.targetDate || null })) });
      onOpenChange(false); onCreated?.(goal.id);
    } catch (error) { onError(error instanceof Error ? error.message : 'Goal was not created.'); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl sm:max-h-[calc(100dvh-3rem)]">
      <DialogHeader><DialogTitle>Create a goal</DialogTitle><DialogDescription>Start from an exam-ready plan, then make every detail yours.</DialogDescription></DialogHeader>
      <section aria-labelledby="templates-heading">
        <h3 id="templates-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-ink">Choose a starting point</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GOAL_TEMPLATES.map((template) => <button key={template.id} type="button" aria-pressed={selected === template.id} onClick={() => { setSelected(template.id); setDraft(templateToGoal(template)); }} className={`press min-h-16 rounded-xl border p-3 text-left text-xs ${selected === template.id ? 'border-brand bg-brand/10 text-ink' : 'border-hairline bg-surface text-muted-ink hover:text-ink'}`}><span className="block font-semibold text-ink">{template.name}</span><span>{template.weeks ? `${template.weeks}-week plan` : 'Open-ended'}</span></button>)}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1 block text-xs text-muted-ink">Goal title</span><Input value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-xs text-muted-ink">Description</span><Textarea value={draft.description} maxLength={2000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded-xl border-hairline bg-surface" /></label>
        <label><span className="mb-1 block text-xs text-muted-ink">Start date</span><Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
        <div><label className="flex min-h-6 items-center gap-2 text-xs text-muted-ink"><input type="checkbox" checked={!draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.checked ? null : draft.startDate })} />Open-ended</label>{draft.targetDate !== null && <Input aria-label="Target date" type="date" min={draft.startDate} value={draft.targetDate || ''} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} className="mt-1" />}</div>
        <fieldset><legend className="mb-1 text-xs text-muted-ink">Calendar cadence</legend><div className="flex gap-1">{(['daily','weekly'] as const).map((mode) => <button key={mode} type="button" aria-pressed={draft.gridMode === mode} onClick={() => setDraft({ ...draft, gridMode: mode })} className={`press flex-1 rounded-xl px-3 py-2 text-xs capitalize ${draft.gridMode === mode ? 'bg-ink text-surface' : 'border border-hairline'}`}>{mode}</button>)}</div></fieldset>
        <fieldset><legend className="mb-1 text-xs text-muted-ink">Goal completion</legend><div className="flex gap-1">{(['auto','manual'] as const).map((policy) => <button key={policy} type="button" aria-pressed={draft.completionPolicy === policy} onClick={() => setDraft({ ...draft, completionPolicy: policy })} className={`press flex-1 rounded-xl px-3 py-2 text-xs capitalize ${draft.completionPolicy === policy ? 'bg-ink text-surface' : 'border border-hairline'}`}>{policy}</button>)}</div></fieldset>
      </div>
      <EditableList title="Ordered sub-goals" items={draft.subGoals} onAdd={() => setDraft({ ...draft, subGoals: [...draft.subGoals, { title: '' }] })} onMove={(i,d) => setDraft({ ...draft, subGoals: move(draft.subGoals, i, d) })} onRemove={(i) => setDraft({ ...draft, subGoals: draft.subGoals.filter((_,x) => x !== i) })} render={(item, i) => <Input aria-label={`Sub-goal ${i + 1}`} maxLength={300} value={item.title} onChange={(e) => updateSub(i, { title: e.target.value })} className="h-10" />} />
      <EditableList title="Milestones" items={draft.milestones} onAdd={() => setDraft({ ...draft, milestones: [...draft.milestones, { title: '', targetDate: null }] })} onMove={(i,d) => setDraft({ ...draft, milestones: move(draft.milestones, i, d) })} onRemove={(i) => setDraft({ ...draft, milestones: draft.milestones.filter((_,x) => x !== i) })} render={(item, i) => <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_150px]"><Input aria-label={`Milestone ${i + 1}`} maxLength={300} value={item.title} onChange={(e) => updateMilestone(i, { title: e.target.value })} className="h-10" /><Input aria-label={`Milestone ${i + 1} target date`} type="date" min={draft.startDate} max={draft.targetDate || undefined} value={item.targetDate || ''} onChange={(e) => updateMilestone(i, { targetDate: e.target.value || null })} className="h-10" /></div>} />
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4"><p className="text-xs text-destructive" role="alert">{validation}</p><button type="button" disabled={Boolean(validation) || create.isPending} onClick={() => void submit()} className="press shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-on-accent disabled:opacity-40">{create.isPending ? 'Creating…' : 'Create goal'}</button></div>
    </DialogContent>
  </Dialog>;
}

function EditableList<T>({ title, items, onAdd, onMove, onRemove, render }: { title: string; items: T[]; onAdd: () => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (index: number) => void; render: (item: T, index: number) => React.ReactNode }) {
  return <section><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-ink">{title}</h3><button type="button" onClick={onAdd} className="press flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-brand"><Plus className="h-3.5 w-3.5" />Add</button></div><ol className="space-y-2">{items.map((item, index) => <li key={index} className="flex items-center gap-1">{render(item, index)}<button type="button" aria-label={`Move ${title} item up`} disabled={index === 0} onClick={() => onMove(index,-1)} className="press grid h-10 w-10 place-items-center rounded-lg disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move ${title} item down`} disabled={index === items.length - 1} onClick={() => onMove(index,1)} className="press grid h-10 w-10 place-items-center rounded-lg disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label={`Remove ${title} item`} onClick={() => onRemove(index)} className="press grid h-10 w-10 place-items-center rounded-lg text-destructive"><Trash2 className="h-4 w-4" /></button></li>)}</ol></section>;
}
