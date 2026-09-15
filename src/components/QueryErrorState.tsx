'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  onRetry: () => Promise<unknown> | void;
  retrying?: boolean;
}

/** Shared failure state so network errors are not misrepresented as empty data. */
export function QueryErrorState({
  title = 'Could not load this content',
  description = 'Check your connection and try again.',
  onRetry,
  retrying = false,
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-8 text-center"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 gap-2"
        onClick={() => void onRetry()}
        loading={retrying}
        loadingLabel="Retrying…"
      >
        {!retrying && <RefreshCw className="h-4 w-4" />}
        Try again
      </Button>
    </div>
  );
}
