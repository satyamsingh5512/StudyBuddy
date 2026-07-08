'use client';

import { useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionProps,
} from 'framer-motion';

interface AnimatedNumberProps {
  /** Target value to settle on. */
  value: number;
  /** Fraction digits to display. Defaults to 0. */
  decimals?: number;
  /** Rendered before the number, e.g. "$". */
  prefix?: string;
  /** Rendered after the number, e.g. "%" or "XP". */
  suffix?: string;
  /** Group digits with locale separators (1,240). Defaults to true. */
  useGrouping?: boolean;
  className?: string;
  /** Spring feel overrides for the count-up. */
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/**
 * A number that counts up to `value` with a light spring settle, giving stats
 * the feel of a live instrument booting up. Respects `prefers-reduced-motion`
 * by snapping straight to the final value.
 *
 * The number is tabular by default (via `tabular-nums`) so digits don't jitter
 * horizontally while animating.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  useGrouping = true,
  className,
  stiffness = 90,
  damping = 22,
  mass = 0.6,
  ...rest
}: AnimatedNumberProps & Omit<MotionProps, 'children'>) {
  const reduce = useReducedMotion();

  // Start from 0 so the value visibly counts up on mount.
  const source = useMotionValue(0);
  const settled = useSpring(source, { stiffness, damping, mass });

  const text = useTransform(settled, (v) => {
    const n = Number.isFinite(v) ? v : 0;
    const formatted = n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (reduce) {
      // Snap: no count-up for reduced-motion users.
      source.jump(value);
      settled.jump(value);
    } else {
      source.set(value);
    }
  }, [value, reduce, source, settled]);

  return (
    <motion.span className={className} style={{ fontVariantNumeric: 'tabular-nums' }} {...rest}>
      {text}
    </motion.span>
  );
}

export default AnimatedNumber;
