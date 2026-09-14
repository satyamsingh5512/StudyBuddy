import { SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6" aria-busy="true">
      <div role="status" aria-live="polite" aria-label="Loading page">
        <SkeletonPage rows={4} />
      </div>
    </main>
  );
}
