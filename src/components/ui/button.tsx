import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

/**
 * Button — StudyBuddy idiom.
 *
 * Buttons are flat: no shadow, no hover lift. Depth comes only from a
 * low-alpha ink hairline, and feedback is a 2% scale press plus a 3% ink wash
 * on hover. Radius is a generous 1rem (`rounded-2xl`) on every size.
 *
 * Variant names are unchanged from the previous glass theme so existing call
 * sites pick up the new language without edits.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-[15px] font-medium tracking-[-0.01em] transition-all duration-150 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-brand text-on-accent hover:brightness-110',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
        outline:
          'border border-hairline bg-surface text-ink hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]',
        secondary: 'bg-surface-muted text-ink hover:bg-ink/[0.05] dark:hover:bg-white/[0.06]',
        ghost: 'text-ink hover:bg-ink/[0.04] dark:hover:bg-white/[0.05]',
        link: 'text-brand underline-offset-4 hover:underline',
        /* Tinted accent button: reads as primary without the full blue fill. */
        subtle: 'bg-brand-subtle text-brand border border-hairline-accent hover:bg-brand-light',
        /* Retained alias so `variant="glass"` call sites keep compiling. */
        glass: 'border border-hairline bg-surface text-ink hover:bg-ink/[0.03]',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-[52px] px-6',
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
  loading?: boolean;
  loadingLabel?: string;
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
      loading = false,
      loadingLabel,
      type,
      children,
      ...props
    },
    ref
  ) => {
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

    const sharedClassName = cn(
      buttonVariants({ variant, size, className }),
      isPressed && !disabled && 'scale-[0.98] transition-transform'
    );

    // Radix Slot calls React.Children.only, so it must receive exactly ONE
    // element. The loading spinner and label are deliberately not injected in
    // this branch: rendering `{loading && <span/>}` alongside `{children}`
    // produces a two-item children array (the first item being `false`), which
    // made Children.only throw
    //   "React.Children.only expected to receive a single React element child"
    // and crashed every page containing a <Button asChild>.
    if (asChild) {
      return (
        <Slot
          {...props}
          className={sharedClassName}
          ref={ref}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          // `disabled` is not a valid attribute on the arbitrary element the
          // caller supplies (commonly an anchor), so express it accessibly.
          aria-disabled={disabled || loading || undefined}
          aria-busy={loading || undefined}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        {...props}
        className={sharedClassName}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        type={type}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        )}
        {loading && loadingLabel ? loadingLabel : children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
