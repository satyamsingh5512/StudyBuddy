'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { GlassSurface, type GlassTier } from './GlassSurface';

/**
 * GlassCard family — API-compatible with `@/components/ui/card`'s
 * Card/CardHeader/CardTitle/CardContent/CardFooter so migrating dashboard
 * call sites is a matter of swapping the import, not rewriting JSX.
 */

export interface GlassCardProps extends React.ComponentProps<typeof GlassSurface> {
  tier?: GlassTier;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, tier = 'card', ...props }, ref) => (
    <GlassSurface
      ref={ref}
      tier={tier}
      className={cn('text-card-foreground', className)}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';

export const GlassCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
GlassCardHeader.displayName = 'GlassCardHeader';

export const GlassCardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
GlassCardTitle.displayName = 'GlassCardTitle';

export const GlassCardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
GlassCardDescription.displayName = 'GlassCardDescription';

export const GlassCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
GlassCardContent.displayName = 'GlassCardContent';

export const GlassCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
GlassCardFooter.displayName = 'GlassCardFooter';
