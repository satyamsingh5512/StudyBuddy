'use client';

/**
 * NativeAppBridge — Capacitor runtime glue (web-safe no-op when absent).
 *
 * - Forwards native app resume/foreground as `studybuddy:app-resumed` so the
 *   FocusGuard re-polls the moment you open the phone mid-focus.
 * - Forwards connectivity changes so the offline outbox flushes promptly.
 * - Requests local-notification permission once (schedule alarms need it).
 */
import { useEffect } from 'react';

export default function NativeAppBridge() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const core = (await import('@capacitor/core').catch(() => null)) as {
          Capacitor?: { isNativePlatform?: () => boolean };
        } | null;
        if (cancelled || !core?.Capacitor?.isNativePlatform?.()) return;

        const { App } = await import('@capacitor/app').catch(() => ({ App: null }));
        App?.addListener?.('resume', () => {
          window.dispatchEvent(new CustomEvent('studybuddy:app-resumed'));
        });
        App?.addListener?.('appStateChange', ({ isActive }: { isActive: boolean }) => {
          if (isActive) window.dispatchEvent(new CustomEvent('studybuddy:app-resumed'));
        });

        const { Network } = await import('@capacitor/network').catch(() => ({ Network: null }));
        Network?.addListener?.('networkStatusChange', (status: { connected: boolean }) => {
          window.dispatchEvent(new CustomEvent(status.connected ? 'online' : 'offline'));
          if (status.connected) {
            void import('@/lib/offline/outbox')
              .then((m) => m.syncOutbox())
              .catch(() => undefined);
          }
        });

        const { LocalNotifications } = await import('@capacitor/local-notifications').catch(() => ({
          LocalNotifications: null,
        }));
        await LocalNotifications?.requestPermissions?.().catch(() => undefined);
      } catch {
        /* web or missing plugins — nothing to bridge */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
