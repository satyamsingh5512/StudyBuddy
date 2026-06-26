import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Base skeleton block with an iOS-style sweeping shimmer.
 * Uses the `.skeleton-shimmer` utility (defined in index.css) which is
 * light/dark aware. Falls back gracefully with `animate-pulse`.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-shimmer animate-pulse rounded-lg bg-muted', className)}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Row of stat cards (Dashboard / Reports headers). */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={`stat-${i}`} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Generic chart / large panel placeholder. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card rounded-2xl p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

/** Full page skeleton: header + stats + content. Good default for views. */
export function SkeletonPage({
  stats = true,
  rows = 5,
}: {
  stats?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {stats && <SkeletonStats />}
      <SkeletonChart />
      <SkeletonList count={rows} />
    </div>
  );
}

export default Skeleton;
