'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * GlassModal — elevated-tier overlay for the dashboard (e.g. reschedule
 * dialog). Mirrors the hand-rolled `motion.div` scrim + panel pattern
 * already used in Dashboard.tsx, but wrapped in AnimatePresence so exit
 * animations actually play (a modal that only animates in and snaps out on
 * close reads unfinished).
 *
 * This intentionally does NOT touch `@/components/ui/dialog` (Radix-based,
 * shared across the whole app) — dashboard modals in this codebase are
 * plain conditionally-rendered overlays, not Radix Dialogs.
 */

export interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** aria-label for the dialog panel when no visible title element covers it. */
  ariaLabel?: string;
}

export function GlassModal({ open, onOpenChange, children, className, ariaLabel }: GlassModalProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sbd-modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/60 [backdrop-filter:blur(6px)] [-webkit-backdrop-filter:blur(6px)] p-4"
          onClick={() => onOpenChange(false)}
          role="presentation"
        >
          <motion.div
            key="sbd-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={
              reduce
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 350, damping: 28, mass: 0.9 }
            }
            className={cn('sbd-glass sbd-glass--elevated max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0', className)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
