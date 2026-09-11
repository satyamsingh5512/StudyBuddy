'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock3,
  Eraser,
  History,
  Lightbulb,
  PencilLine,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardHeader } from '@/components/dashboard/glass/GlassCard';
import { useGenerateSchedule, useSchedules, type Schedule } from '@/lib/queries';
import { useToast } from '@/components/ui/use-toast';
import {
  clearPromptHistory,
  loadPromptHistory,
  mergeHistory,
  removePromptFromHistory,
  savePromptToHistory,
  type PromptHistoryEntry,
} from '@/lib/schedulePromptHistory';
import { cn } from '@/lib/utils';

const PROMPT_SUGGESTIONS = [
  'Create a full-day DSA practice schedule. I have Arrays, Binary Trees, and Dynamic Programming to cover.',
  'Plan my JEE revision for today — Physics (Mechanics), Chemistry (Organic), Maths (Integration).',
  'I have 4 hours free. Give me a UPSC GS schedule covering Polity, History, and Current Affairs.',
  'Schedule a mix of NEET subjects: Biology (Genetics), Chemistry (p-block), Physics (Optics).',
  'I have a mock test tomorrow. Create a high-intensity revision plan for today.',
];

interface AIScheduleGeneratorProps {
  onGenerated: (schedule: Schedule) => void;
  selectedDate: string;
}

function formatDate(d: string) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AIScheduleGenerator({ onGenerated, selectedDate }: AIScheduleGeneratorProps) {
  const { toast } = useToast();
  const generate = useGenerateSchedule();
  const { data: pastSchedules = [] } = useSchedules();

  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('');
  const [localHistory, setLocalHistory] = useState<PromptHistoryEntry[]>([]);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalHistory(loadPromptHistory());
  }, []);

  const history = useMemo(
    () => mergeHistory(localHistory, pastSchedules),
    [localHistory, pastSchedules]
  );

  const filteredHistory = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return history;
    return history.filter((e) => e.prompt.toLowerCase().includes(q));
  }, [history, historyFilter]);

  const visibleHistory = expandedHistory ? filteredHistory : filteredHistory.slice(0, 4);

  const loadIntoEditor = (entry: PromptHistoryEntry) => {
    // Intentionally only fills the editor — the user reviews/edits, then generates.
    setPrompt(entry.prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleDeleteEntry = (entryPrompt: string) => {
    setLocalHistory(removePromptFromHistory(entryPrompt));
    // Server-derived entries can't be deleted from history alone; they disappear
    // only when the underlying schedule is deleted. Local removal still hides
    // duplicates via merge order, so keep the UX simple: just refresh.
  };

  const handleClearHistory = () => {
    setLocalHistory(clearPromptHistory());
    setHistoryFilter('');
    toast({ title: 'Prompt history cleared on this device.' });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Describe what to plan first',
        description: 'Add a few details — subjects, available hours, breaks.',
        variant: 'destructive',
      });
      textareaRef.current?.focus();
      return;
    }
    try {
      const result = await generate.mutateAsync({ prompt: prompt.trim(), date: selectedDate });
      setLocalHistory(savePromptToHistory(prompt.trim(), selectedDate));
      onGenerated(result);
      toast({
        title: 'Schedule generated',
        description: `${result.items.length} tasks planned for ${formatDate(selectedDate)}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err?.message ?? 'Check your connection and try again.',
        variant: 'destructive',
      });
    }
  };

  const canGenerate = prompt.trim().length > 0 && !generate.isPending;

  return (
    <GlassCard className="overflow-hidden border-border/60">
      <GlassCardHeader className="border-b border-border/40 bg-muted/30 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">Create study plan</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Describe your day — AI builds a time-blocked schedule.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(selectedDate)}
            </span>
            {history.length > 0 && (
              <span className="hidden rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline">
                {history.length} saved
              </span>
            )}
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4 pt-4">
        {/* Editor */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="schedule-prompt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Instructions
            </label>
            {prompt && (
              <button
                onClick={() => setPrompt('')}
                disabled={generate.isPending}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Eraser className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <div className="relative">
            <textarea
              id="schedule-prompt"
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canGenerate) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder={`For ${formatDate(selectedDate)} — subjects, topics, free hours, breaks…

Example: "DSA Trees + Graphs, Maths Calculus, one mock test. Free 9 AM–8 PM, short break every 90 min."`}
              rows={5}
              disabled={generate.isPending}
              className={cn(
                'w-full resize-y rounded-lg border border-border/70 bg-background px-3.5 py-3',
                'text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60',
                'focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15',
                'min-h-28 max-h-64 transition-colors',
                generate.isPending && 'cursor-not-allowed opacity-60'
              )}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{prompt.length} / 2000 · ⌘/Ctrl + Enter to generate</span>
            {generate.isPending && <span className="font-medium text-primary">Generating…</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold',
              'bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
              'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {generate.isPending ? (
              <>
                <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Building schedule…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate schedule
              </>
            )}
          </button>
          <button
            onClick={() => setShowSuggestions((p) => !p)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Lightbulb className="h-4 w-4" />
            Ideas
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showSuggestions && 'rotate-180')} />
          </button>
        </div>

        {showSuggestions && (
          <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-dashed border-border/70 bg-muted/30 p-2.5">
            {PROMPT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => loadIntoEditor({ prompt: s, date: selectedDate, createdAt: new Date().toISOString(), source: 'local' })}
                className="rounded-md px-2.5 py-2 text-left text-xs leading-relaxed text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <span className="mr-1.5 font-semibold text-primary">+</span>
                {s}
              </button>
            ))}
          </div>
        )}

        {generate.isPending && (
          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3" aria-live="polite">
            {[92, 78, 85].map((w, i) => (
              <div
                key={i}
                className="h-2 animate-pulse rounded-full bg-muted-foreground/20"
                style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Reading your availability and placing study blocks…
            </p>
          </div>
        )}

        {/* History */}
        <div className="rounded-lg border border-border/60">
          <button
            onClick={() => setShowHistory((p) => !p)}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
            aria-expanded={showHistory}
          >
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Previous prompts</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {filteredHistory.length}
            </span>
            <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', showHistory && 'rotate-180')} />
          </button>

          {showHistory && (
            <div className="border-t border-border/50 px-3.5 py-3">
              {history.length === 0 ? (
                <p className="rounded-md bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
                  No previous prompts yet. Your recent instructions will appear here for quick reuse.
                </p>
              ) : (
                <>
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <input
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                        placeholder="Search previous prompts…"
                        className="w-full rounded-md border border-border/60 bg-background py-1.5 pl-8 pr-7 text-xs focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                      />
                      {historyFilter && (
                        <button
                          onClick={() => setHistoryFilter('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleClearHistory}
                      title="Clear history on this device"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      No prompts match “{historyFilter}”.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {visibleHistory.map((entry) => (
                        <li
                          key={`${entry.createdAt}-${entry.prompt.slice(0, 24)}`}
                          className="group flex items-start gap-2 rounded-md border border-transparent px-2 py-2 hover:border-border/60 hover:bg-muted/40"
                        >
                          <button
                            onClick={() => loadIntoEditor(entry)}
                            title="Load into editor — review and edit before generating"
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="line-clamp-2 text-xs leading-relaxed text-foreground">
                              {entry.prompt}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {timeAgo(entry.createdAt)}
                              </span>
                              {entry.date && <span>· for {formatDate(entry.date)}</span>}
                              {entry.source === 'schedule' && (
                                <span className="rounded bg-secondary px-1 py-px text-[10px]">past plan</span>
                              )}
                            </span>
                          </button>
                          <span className="flex flex-shrink-0 items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              onClick={() => loadIntoEditor(entry)}
                              title="Edit & reuse"
                              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <PencilLine className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.prompt)}
                              title="Remove from this device"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {filteredHistory.length > 4 && (
                    <button
                      onClick={() => setExpandedHistory((p) => !p)}
                      className="mt-2 w-full rounded-md py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {expandedHistory ? 'Show less' : `Show all ${filteredHistory.length}`}
                    </button>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
                    Selecting a prompt loads it into the editor above — edit it freely, then press
                    Generate. Nothing runs until you confirm.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
