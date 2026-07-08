'use client';

import { forwardRef, useEffect, useState } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

/**
 * GlassButton — dashboard-scoped button primitive. Renders a real <button>
 * (or slots into an <a> via asChild) so semantics/keyboard/AT support come
 * for free — never a styled div with onClick.
 */

const glassButtonVariants = cva(
  'sbd-glass inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      tier: {
        card: 'sbd-glass--card',
        elevated: 'sbd-glass--elevated',
      },
      variant: {
        default: 'text-foreground hover:text-primary',
        primary: 'text-primary-foreground bg-primary/90 hover:bg-primary',
        ghost: 'border-transparent shadow-none bg-transparent hover:bg-white/10',
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-[var(--sbd-glass-radius-sm)]',
        sm: 'h-9 px-3 rounded-[var(--sbd-glass-radius-sm)]',
        lg: 'h-11 px-8 rounded-[var(--sbd-glass-radius-sm)]',
        icon: 'h-10 w-10 rounded-[var(--sbd-glass-radius-sm)]',
      },
    },
    defaultVariants: {
      tier: 'card',
      variant: 'default',
      size: 'default',
    },
  }
);

export interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref'>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  /** Extra-jelly squash-and-stretch tap, for primary tappable surfaces. */
  jellyTap?: boolean;
  disableSound?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      tier,
      variant,
      size,
      asChild = false,
      jellyTap = false,
      disableSound = false,
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    const reduce = useReducedMotion();
    const [hoverCapable, setHoverCapable] = useState(false);

    useEffect(() => {
      setHoverCapable(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false);
    }, []);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableSound && !disabled) soundManager.playClick();
      onClick?.(e);
    };

    if (asChild) {
      // Slot path: no motion wrapper (Slot forwards a single child element,
      // typically an <a>), keep semantics of the child intact.
      return (
        <Slot
          className={cn(glassButtonVariants({ tier, variant, size, className }))}
          {...(props as any)}
        />
      );
    }

    const whileHover =
      !reduce && hoverCapable
        ? { scale: 1.02, transition: { type: 'spring' as const, stiffness: 400, damping: 24, mass: 0.9 } }
        : undefined;

    const whileTap = !reduce
      ? jellyTap
        ? { scaleX: 1.04, scaleY: 0.94, transition: { type: 'spring' as const, stiffness: 500, damping: 12, mass: 0.6 } }
        : { scale: 0.965, transition: { type: 'spring' as const, stiffness: 520, damping: 18, mass: 0.6 } }
      : undefined;

    return (
      <motion.button
        ref={ref}
        type={props.type ?? 'button'}
        className={cn(
          glassButtonVariants({ tier, variant, size, className }),
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        whileHover={whileHover}
        whileTap={whileTap}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      />
    );
  }
);
GlassButton.displayName = 'GlassButton';
