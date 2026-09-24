'use client';

/**
 * NativeAppBridge — Capacitor runtime glue (web-safe no-op when absent).
 *
 * - Forwards native app resume/foreground as `studybuddy:app-resumed` so the
 *   FocusGuard re-polls the moment you open the phone mid-focus.
 * - Forwards connectivity changes so the offline outbox flushes promptly.
 * - Requests local-notification permission once (schedule alarms need it).
 * - Completes in-app Google sign-in when the OAuth Custom Tab returns to the
 *   `studybuddy://auth/callback` deep link.
 */
import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { completeNativeGoogleSignIn, isNativeAuthCallbackUrl } from '@/lib/nativeGoogleAuth';

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

        // Google sign-in runs in a Custom Tab and returns here via deep link.
        // The session cookie is created by this exchange, inside the WebView.
        App?.addListener?.('appUrlOpen', ({ url }: { url: string }) => {
          if (!isNativeAuthCallbackUrl(url)) return;
          void (async () => {
            const result = await completeNativeGoogleSignIn(url);
            if (result.status === 'completed') {
              // Full reload so the app re-runs its authenticated bootstrap with
              // the freshly issued cookie. Routing straight to onboarding for a
              // new account avoids a visible redirect bounce through AuthGuard.
              window.location.assign(result.onboardingDone ? '/dashboard' : '/onboarding');
              return;
            }
            if (result.status === 'cancelled') {
              toast({ title: 'Sign-in cancelled', description: result.message });
              return;
            }
            if (result.status === 'error') {
              toast({ title: 'Google sign-in failed', description: result.message, variant: 'destructive' });
            }
          })();
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
