import type { Variants } from 'framer-motion';

/**
 * Dashboard glass entrance variants — cards/grids appearing on first load or
 * filter changes. Stagger children 30–50ms apart; each item springs in with
 * opacity + translateY + scale.
 *
 * Extends (does not fork) the app's existing motion language in
 * `@/lib/motion.ts` — same spring/stagger philosophy, tuned to the values
 * called out in the glass redesign spec.
 */

export const glassStaggerContainer = (stagger = 0.04, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
});

export const glassEntranceItem: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

export const glassEntranceItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
};

export const getGlassEntranceItem = (reduce: boolean | null): Variants =>
  reduce ? glassEntranceItemReduced : glassEntranceItem;
