'use client';

/**
 * useOfflineSync — auto-flush the outbox whenever connectivity returns.
 *
 * - Listens to browser online/offline + Capacitor network status when present.
 * - Syncs on mount, on reconnect, and every 45s while online with pending ops.
 * - Emits `studybuddy:outbox-synced` so React Query lists can invalidate.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pendingOutboxCount, syncOutbox } from './outbox';

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const syncingRef = useRef(false);

  const refreshPending = useCallback(() => {
    setPending(pendingOutboxCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncOutbox();
      // Focus state is ephemeral rather than a normal user-data mutation, but
      // preserving the latest start/end intent keeps cross-device guarding
      // correct after a temporary offline period.
      await import('@/lib/focusSession')
        .then(({ syncPendingFocusIntent }) => syncPendingFocusIntent())
        .catch(() => false);
      setPending(result.pending);
      if (result.synced > 0) {
        // Refresh everything that could have changed server-side.
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['todos'] }),
          queryClient.invalidateQueries({ queryKey: ['schedules'] }),
          queryClient.invalidateQueries({ queryKey: ['notes'] }),
          queryClient.invalidateQueries({ queryKey: ['efficiency'] }),
          queryClient.invalidateQueries({ queryKey: ['timer'] }),
        ]);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    refreshPending();
    void syncNow();

    const onOnline = () => {
      setIsOnline(true);
      // Small delay: the radio is often up before the backend is reachable.
      window.setTimeout(() => void syncNow(), 1500);
    };
    const onOffline = () => setIsOnline(false);
    const onQueueChanged = () => refreshPending();
    const onSynced = () => {
      refreshPending();
      void queryClient.invalidateQueries({ queryKey: ['todos'], refetchType: 'active' });
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('studybuddy:outbox-changed', onQueueChanged);
    window.addEventListener('studybuddy:outbox-synced', onSynced);

    const interval = window.setInterval(() => {
      if (pendingOutboxCount() > 0) void syncNow();
    }, 45_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('studybuddy:outbox-changed', onQueueChanged);
      window.removeEventListener('studybuddy:outbox-synced', onSynced);
      window.clearInterval(interval);
    };
  }, [queryClient, refreshPending, syncNow]);

  return { pending, isSyncing, isOnline, syncNow };
}
