'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, Calendar, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/dashboard/glass/GlassCard';
import { useGenerateSchedule, type Schedule } from '@/lib/queries';
import { useToast } from '@/components/ui/use-toast';
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

export default function AIScheduleGenerator({ onGenerated, selectedDate }: AIScheduleGeneratorProps) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const generate = useGenerateSchedule();

  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Prompt is empty', description: 'Tell the AI what you want to study.', variant: 'destructive' });
      return;
    }
    try {
      const result = await generate.mutateAsync({ prompt: prompt.trim(), date: selectedDate });
      onGenerated(result);
      toast({
        title: '✨ Schedule generated!',
        description: `${result.items.length} tasks planned for ${formatDate(selectedDate)}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err?.message ?? 'Please check your internet connection and try again.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <GlassCard className="overflow-hidden">
      <GlassCardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <GlassCardTitle className="text-base">AI Schedule Generator</GlassCardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Describe what you want to study — AI builds a time-blocked plan
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-secondary/60 px-2.5 py-1 sm:ml-auto">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{formatDate(selectedDate)}</span>
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4">
        {/* Prompt textarea */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Tell the AI what to plan for ${formatDate(selectedDate)}…\n\nExample: "I need to study DSA (Trees + Graphs), revise Maths (Calculus), and do one mock test. I have from 9 AM to 8 PM free. Include short breaks every 1.5 hours."`}
            rows={6}
            disabled={generate.isPending}
            className={cn(
              'w-full resize-none rounded-xl border border-border/50 bg-background/60 px-4 py-3',
              'text-sm text-foreground placeholder:text-muted-foreground/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              'transition-all duration-200 leading-relaxed',
              generate.isPending && 'opacity-60 cursor-not-allowed'
            )}
          />
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/50">
            {prompt.length} chars
          </div>
        </div>

        {/* Suggestions toggle */}
        <div>
          <button
            onClick={() => setShowSuggestions((p) => !p)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Prompt ideas</span>
            {showSuggestions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={reduce ? {} : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduce ? {} : { opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 grid grid-cols-1 gap-2">
                  {PROMPT_SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPrompt(s);
                        setShowSuggestions(false);
                      }}
                      className="text-left text-xs p-3 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/40 hover:border-primary/30 transition-all duration-150 line-clamp-2"
                    >
                      "{s}"
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generate.isPending || !prompt.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 font-semibold text-sm py-3 px-4 rounded-xl',
            'transition-all duration-200',
            'bg-gradient-to-r from-primary to-violet-500 text-white',
            'hover:from-primary/90 hover:to-violet-500/90 hover:shadow-lg hover:shadow-primary/30',
            'active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none',
            'shadow-md shadow-primary/20'
          )}
        >
          {generate.isPending ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full flex-shrink-0" />
              Building your schedule…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              Generate AI Schedule
            </>
          )}
        </button>

        {generate.isPending && (
          <motion.div
            initial={reduce ? {} : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            {/* Animated shimmer bars */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-2.5 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-pulse"
                style={{ width: `${70 + Math.sin(i * 1.2) * 25}%`, animationDelay: `${i * 0.12}s` }}
              />
            ))}
            <p className="text-xs text-muted-foreground mt-1">Crafting your personalized schedule…</p>
          </motion.div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
