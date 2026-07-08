'use client';

import { forwardRef, useEffect, useState } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * GlassSurface — base primitive every dashboard glass component composes
 * from. Scope: dashboard module only (see src/styles/dashboard-glass*.css).
 *
 * Never hardcode blur/opacity/color in feature components — everything
 * here derives from the `--sbd-glass-*` tokens via the `sbd-glass--*`
 * classes.
 */

export type GlassTier = 'ambient' | 'card' | 'elevated';

export interface GlassSurfaceProps extends HTMLMotionProps<'div'> {
  tier?: GlassTier;
  /** Enables hover-lift + tap "jelly compress" micro-interactions. */
  interactive?: boolean;
  /** Use the extra squash-and-stretch tap variant on primary tappable surfaces. */
  jellyTap?: boolean;
  className?: string;
}

const tierClass: Record<GlassTier, string> = {
  ambient: 'sbd-glass sbd-glass--ambient',
  card: 'sbd-glass sbd-glass--card',
  elevated: 'sbd-glass sbd-glass--elevated',
};

/** Desktop-only hover (never fires on touch — gated via CSS hover media query
 *  through Tailwind's default `hover:` which already compiles to
 *  `@media (hover: hover)`-safe behavior is NOT guaranteed by Tailwind alone,
 *  so we additionally gate the whileHover prop itself using matchMedia). */
function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(false);
  useEffect(() => {
    setHoverCapable(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false);
  }, []);
  return hoverCapable;
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  (
    { tier = 'card', interactive = false, jellyTap = false, className, style, children, ...props },
    ref
  ) => {
    const reduce = useReducedMotion();
    const hoverCapable = useHoverCapable();

    const whileHover =
      interactive && !reduce && hoverCapable
        ? {
            scale: 1.025,
            transition: { type: 'spring' as const, stiffness: 400, damping: 24, mass: 0.9 },
          }
        : undefined;

    const whileTap =
      interactive && !reduce
        ? jellyTap
          ? {
              scaleX: 1.04,
              scaleY: 0.94,
              transition: { type: 'spring' as const, stiffness: 500, damping: 12, mass: 0.6 },
            }
          : {
              scale: 0.965,
              transition: { type: 'spring' as const, stiffness: 520, damping: 18, mass: 0.6 },
            }
        : undefined;

    return (
      <motion.div
        ref={ref}
        className={cn(tierClass[tier], className)}
        style={style}
        whileHover={whileHover}
        whileTap={whileTap}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassSurface.displayName = 'GlassSurface';
