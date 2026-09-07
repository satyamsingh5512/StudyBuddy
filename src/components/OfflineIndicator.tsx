'use client';

/**
 * OfflineIndicator — tiny status pill.
 *
 * - Offline: amber "Offline · N queued".
 * - Online + pending: "Syncing… / N pending · tap to retry".
 * - Fully synced: renders nothing (no visual noise during focus).
 */
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';

export default function OfflineIndicator() {
  const { pending, isSyncing, isOnline, syncNow } = useOfflineSync();

  if (isOnline && pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={isOnline ? 'Retry sync now' : 'You are offline — changes are saved on this device'}
      className={`fixed bottom-4 left-4 z-[90] flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur transition-colors min-h-[44px] ${
        isOnline
          ? 'bg-background/90 border-border text-foreground'
          : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
      }`}
    >
      {isOnline ? (
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      {isOnline
        ? isSyncing
          ? `Syncing… (${pending})`
          : `${pending} pending · tap to sync`
        : pending > 0
          ? `Offline · ${pending} saved on device`
          : 'Offline · changes save on device'}
    </button>
  );
}
