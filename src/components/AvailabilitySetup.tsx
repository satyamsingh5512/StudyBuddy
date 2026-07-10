'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, Plus, Trash2, Check, ChevronRight, Sunrise, Moon } from 'lucide-react';
import { GlassModal } from '@/components/dashboard/glass/GlassModal';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/dashboard/glass/GlassCard';
import { GlassButton } from '@/components/dashboard/glass/GlassButton';
import { useToast } from '@/components/ui/use-toast';
import { useUpsertAvailability, type TimeBlock, type Availability } from '@/lib/queries';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimeBlockRowProps {
  block: TimeBlock & { id: string };
  onRemove: (id: string) => void;
  onChange: (id: string, field: keyof TimeBlock, value: any) => void;
  type: 'free' | 'blocked';
}

function TimeBlockRow({ block, onRemove, onChange, type }: TimeBlockRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className={cn(
        'flex flex-wrap items-center gap-2 p-3 rounded-xl border',
        type === 'free'
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-rose-500/10 border-rose-500/20'
      )}
    >
      {/* Day selector */}
      <div className="flex gap-1 flex-wrap">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => onChange(block.id, 'dayOfWeek', i)}
            className={cn(
              'h-7 w-7 rounded-lg text-xs font-semibold transition-all duration-150',
              block.dayOfWeek === i
                ? type === 'free'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
                : 'bg-background/60 text-muted-foreground hover:bg-background'
            )}
          >
            {d[0]}
          </button>
        ))}
      </div>

      {/* Time range */}
      <div className="flex items-center gap-1.5 ml-auto">
        <input
          type="time"
          value={block.startTime}
          onChange={(e) => onChange(block.id, 'startTime', e.target.value)}
          className="bg-background/70 border border-border/50 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <input
          type="time"
          value={block.endTime}
          onChange={(e) => onChange(block.id, 'endTime', e.target.value)}
          className="bg-background/70 border border-border/50 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Label */}
      {type === 'blocked' && (
        <input
          placeholder="Label (e.g. College)"
          value={block.label ?? ''}
          onChange={(e) => onChange(block.id, 'label', e.target.value)}
          className="flex-1 min-w-28 bg-background/70 border border-border/50 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}

      <button
        onClick={() => onRemove(block.id)}
        className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

interface AvailabilitySetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Availability;
  onSaved?: () => void;
}

let idCounter = 0;
function newId() {
  return `tb_${Date.now()}_${++idCounter}`;
}

function toRowBlocks(blocks: TimeBlock[]) {
  return blocks.map((b) => ({ ...b, id: newId() }));
}

export default function AvailabilitySetup({ open, onOpenChange, initialData, onSaved }: AvailabilitySetupProps) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const upsert = useUpsertAvailability();

  const [step, setStep] = useState(0);
  const [wakeTime, setWakeTime] = useState(initialData?.wakeTime ?? '06:00');
  const [sleepTime, setSleepTime] = useState(initialData?.sleepTime ?? '23:00');
  const [freeBlocks, setFreeBlocks] = useState<(TimeBlock & { id: string })[]>(
    initialData?.freeBlocks ? toRowBlocks(initialData.freeBlocks) : []
  );
  const [blockedSlots, setBlockedSlots] = useState<(TimeBlock & { id: string })[]>(
    initialData?.blockedSlots ? toRowBlocks(initialData.blockedSlots) : []
  );

  const addFree = () =>
    setFreeBlocks((p) => [...p, { id: newId(), dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }]);

  const addBlocked = () =>
    setBlockedSlots((p) => [...p, { id: newId(), dayOfWeek: 1, startTime: '14:00', endTime: '16:00', label: '' }]);

  const removeFree = (id: string) => setFreeBlocks((p) => p.filter((b) => b.id !== id));
  const removeBlocked = (id: string) => setBlockedSlots((p) => p.filter((b) => b.id !== id));

  function changeFree(id: string, field: keyof TimeBlock, value: any) {
    setFreeBlocks((p) => p.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }
  function changeBlocked(id: string, field: keyof TimeBlock, value: any) {
    setBlockedSlots((p) => p.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        freeBlocks: freeBlocks.map(({ id: _id, ...rest }) => rest),
        blockedSlots: blockedSlots.map(({ id: _id, ...rest }) => rest),
        wakeTime,
        sleepTime,
      });
      toast({ title: 'Availability saved!', description: 'The AI will now plan around your schedule.' });
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const steps = [
    {
      title: 'Daily Schedule',
      subtitle: 'When do you wake up and sleep?',
      icon: <Sunrise className="h-5 w-5 text-amber-400" />,
    },
    {
      title: 'Free Windows',
      subtitle: 'When are you available to study?',
      icon: <Check className="h-5 w-5 text-emerald-400" />,
    },
    {
      title: 'Blocked Time',
      subtitle: 'Classes, travel, meals — mark as busy.',
      icon: <Clock className="h-5 w-5 text-rose-400" />,
    },
  ];

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Set up your availability"
      className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-border/40">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Set Your Availability</h2>
            <p className="text-sm text-muted-foreground">Help the AI build a schedule that fits your life</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200',
                step === i ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50'
              )}
            >
              <span className="text-base">{s.icon}</span>
              <span className={cn('text-xs font-semibold hidden sm:block', step === i ? 'text-primary' : 'text-muted-foreground')}>
                {s.title}
              </span>
              <div className={cn('h-0.5 w-8 rounded-full mt-1', step === i ? 'bg-primary' : 'bg-border/50')} />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={reduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <p className="text-sm text-muted-foreground">
                Your typical daily boundaries. The AI won't schedule anything outside these hours.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Sunrise className="h-4 w-4 text-amber-400" /> Wake up time
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full bg-background/70 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Moon className="h-4 w-4 text-blue-400" /> Sleep time
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full bg-background/70 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={reduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Add time windows when you are free to study. The AI prioritizes filling these slots.
              </p>
              <AnimatePresence>
                {freeBlocks.map((b) => (
                  <TimeBlockRow key={b.id} block={b} type="free" onRemove={removeFree} onChange={changeFree} />
                ))}
              </AnimatePresence>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={addFree}
                className="w-full border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus className="h-4 w-4 mr-1" /> Add free window
              </GlassButton>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={reduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Mark times you are busy — classes, commute, meals. The AI will not schedule study tasks here.
              </p>
              <AnimatePresence>
                {blockedSlots.map((b) => (
                  <TimeBlockRow key={b.id} block={b} type="blocked" onRemove={removeBlocked} onChange={changeBlocked} />
                ))}
              </AnimatePresence>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={addBlocked}
                className="w-full border-dashed border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                <Plus className="h-4 w-4 mr-1" /> Add blocked slot
              </GlassButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-border/40 flex items-center justify-between gap-3">
        <GlassButton variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </GlassButton>

        <div className="flex gap-2">
          {step < steps.length - 1 ? (
            <GlassButton size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </GlassButton>
          ) : (
            <GlassButton size="sm" onClick={handleSave} disabled={upsert.isPending} className="gap-1 bg-primary/80 hover:bg-primary text-white">
              {upsert.isPending ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Availability
            </GlassButton>
          )}
        </div>
      </div>
    </GlassModal>
  );
}
