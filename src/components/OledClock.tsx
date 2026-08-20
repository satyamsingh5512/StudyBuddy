'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { useGoals } from '@/lib/goalQueries';
import { getDaysUntil } from '@/lib/utils';

interface OledClockProps {
  isOpen: boolean;
  onClose: () => void;
}

// Nearest upcoming deadline among a user's active goals (targetDate) and
// their exam date, picked purely by soonest date so the clock always shows
// the single most urgent countdown rather than an arbitrary list.
function useNearestDeadline(referenceTime: number) {
  const [user] = useAtom(userAtom);
  const examDate = user?.examDate;
  const examGoal = user?.examGoal;
  const { data: goals } = useGoals({ status: 'active' });

  return useMemo(() => {
    const candidates: { label: string; date: Date }[] = [];

    if (examDate) {
      const date = new Date(examDate);
      if (!isNaN(date.getTime())) {
        candidates.push({ label: examGoal || 'Exam', date });
      }
    }

    (goals || []).forEach((goal) => {
      if (!goal.targetDate) return;
      const date = new Date(goal.targetDate);
      if (isNaN(date.getTime())) return;
      candidates.push({ label: goal.title, date });
    });

    const upcoming = candidates
      .filter((candidate) => candidate.date.getTime() >= referenceTime - 24 * 60 * 60 * 1000)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return upcoming[0] || null;
  }, [examDate, examGoal, goals, referenceTime]);
}

export default function OledClock({ isOpen, onClose }: OledClockProps) {
  const [now, setNow] = useState<Date | null>(null);
  const nearestDeadline = useNearestDeadline(now?.getTime() ?? 0);

  useEffect(() => {
    if (!isOpen) return;
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !now) return null;

  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const daysUntilGoal = nearestDeadline ? getDaysUntil(nearestDeadline.date) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Clock"
      onClick={onClose}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 min-h-[44px] min-w-[44px] text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
        aria-label="Close clock"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 text-center">
        <div
          className="font-mono font-light tabular-nums text-white select-none"
          style={{ fontSize: 'clamp(3.5rem, 16vw, 10rem)', letterSpacing: '0.02em', lineHeight: 1 }}
        >
          {timeString}
        </div>

        <div
          className="font-light text-neutral-500 select-none"
          style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)' }}
        >
          {dateString}
        </div>

        {nearestDeadline && daysUntilGoal !== null && (
          <div className="mt-6 sm:mt-10 flex flex-col items-center gap-1">
            <div
              className="font-mono font-light tabular-nums text-neutral-400 select-none"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}
            >
              {daysUntilGoal} {daysUntilGoal === 1 ? 'day' : 'days'}
            </div>
            <div
              className="text-neutral-600 select-none max-w-[80vw] truncate"
              style={{ fontSize: 'clamp(0.75rem, 2vw, 0.95rem)' }}
            >
              remaining &middot; {nearestDeadline.label}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
