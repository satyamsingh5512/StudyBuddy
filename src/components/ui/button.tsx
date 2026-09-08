import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

/**
 * Button — Apple taste (DESIGN.md).
 *
 * Two grammars: the signature blue pill CTA (`default`, 17px/400, 11px×22px,
 * full pill) and compact utility rects. No shadow, no hover lift. Feedback is
 * the system-wide scale(0.95) press; keyboard focus is a 2px #0071e3 ring.
 *
 * Variant names are unchanged from the previous theme so existing call
 * sites pick up the new language without edits.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[17px] font-normal tracking-[-0.022em] transition-all duration-150 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-50 active:scale-[0.95] cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-brand text-on-accent hover:brightness-110',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
        outline:
          'border border-hairline bg-surface text-ink hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]',
        /* Pearl capsule: near-white fill, soft ring, caption voice. */
        secondary:
          'rounded-[11px] bg-pearl text-sm text-ink shadow-[inset_0_0_0_3px_rgba(0,0,0,0.04)] hover:bg-ink/[0.03] dark:bg-white/[0.08] dark:shadow-none dark:hover:bg-white/[0.12]',
        ghost: 'text-ink hover:bg-ink/[0.04] dark:hover:bg-white/[0.05]',
        link: 'text-brand underline-offset-4 hover:underline dark:text-skylink',
        /* Ghost pill: transparent fill, blue text + border — the second CTA. */
        subtle: 'border border-brand/60 text-brand hover:bg-brand-subtle dark:border-skylink/60 dark:text-skylink',
        /* Retained alias so `variant="glass"` call sites keep compiling. */
        glass: 'border border-hairline bg-surface text-ink hover:bg-ink/[0.03]',
      },
      size: {
        default: 'h-11 px-[22px] py-[11px]',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-[52px] px-7 text-[18px] font-light',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  disableSound?: boolean; // Option to disable sound for specific buttons
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      onClick,
      disableSound = false,
      disabled,
      type,
      children,
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const [isPressed, setIsPressed] = React.useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Play click sound unless disabled or button is disabled
      if (!disableSound && !disabled) {
        soundManager.playClick();
      }
      // Call original onClick handler if provided
      onClick?.(e);
    };

    const handleMouseDown = () => {
      if (!disabled) {
        setIsPressed(true);
      }
    };

    const handleMouseUp = () => {
      setIsPressed(false);
    };

    const handleMouseLeave = () => {
      setIsPressed(false);
    };

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          isPressed && !disabled && 'scale-[0.95] transition-transform'
        )}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        type={type}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
