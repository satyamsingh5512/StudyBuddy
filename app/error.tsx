'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the route boundary intentionally quiet; errors are shown in the UI
    // without leaking request details or credentials into the console.
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
      <section className="w-full rounded-2xl border border-hairline bg-surface p-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-ink">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">This page could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-ink">
          Your account and saved work are safe. Try the page again or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>Try again</Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign('/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </section>
    </main>
  );
}
