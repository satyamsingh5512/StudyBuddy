import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion language for StudyBuddy.
 *
 * The dashboard reads like a telemetry / instrument cluster for exam prep, so
 * motion here is calm and mechanical: things settle into place with a light
 * spring rather than bouncing. Keep every animated surface derived from these
 * tokens so the whole app moves with one voice.
 *
 * All consumers must respect `prefers-reduced-motion`. Use `useReducedMotion()`
 * from framer-motion and fall back to `instant`/no transition when it is true.
 */

/** Cubic-bezier easings tuned for UI. `standard` is the workhorse. */
export const easing = {
  /* smooth, slightly eager settle — good for entrances */
  standard: [0.22, 1, 0.36, 1] as const,
  /* symmetric ease for reversible states (hover in/out) */
  soft: [0.4, 0, 0.2, 1] as const,
} as const;

/** Duration scale in seconds. Prefer these over ad-hoc numbers. */
export const duration = {
  fast: 0.2,
  base: 0.4,
  slow: 0.6,
} as const;

/** Light spring used for settling numbers, lifts, and panel reveals. */
export const spring: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 20,
  mass: 0.7,
};

/** Snappier spring for interactive feedback (hover, tap). */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 26,
};

/**
 * Orchestration container. Children with the `riseItem` variant animate in
 * sequence. Tune the cadence via `staggerContainer(stagger, delay)`.
 */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
});

/** A single element that rises and fades into place. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.standard },
  },
};

/** Panel-scale reveal for larger surfaces (cards, sheets). */
export const riseScaleItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.slow, ease: easing.standard },
  },
};

/**
 * Reduced-motion-safe variants: no transform, near-instant opacity only.
 * Swap these in when `useReducedMotion()` returns true.
 */
export const reducedRiseItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
};

/**
 * Pick the correct item variant for the current motion preference.
 * @param reduce result of `useReducedMotion()`
 */
export const getRiseItem = (reduce: boolean | null): Variants =>
  reduce ? reducedRiseItem : riseItem;
