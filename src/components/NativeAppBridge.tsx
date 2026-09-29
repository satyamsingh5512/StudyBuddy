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
 * - Routes invite deep links (`studybuddy://invite/<id>` and the equivalent
 *   https link) to the in-app `/invite/<id>` page.
 */
import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { completeNativeGoogleSignIn, isNativeAuthCallbackUrl } from '@/lib/nativeGoogleAuth';

/** Mongo ObjectId hex form; anything else was never a StudyBuddy user id. */
const INVITE_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Maps an invite deep link to the in-app route, or returns null when the URL is
 * not one.
 *
 * Two shapes are accepted, matching the manifest intent-filters: the custom scheme
 * `studybuddy://invite/<id>` used by the share sheet, and `https://sbd.satym.in/invite/<id>`
 * so a link pasted into any messaging app opens the installed APK.
 *
 * The id is validated here rather than at the destination because this function
 * feeds window.location.assign; accepting an arbitrary trailing segment would let a
 * crafted deep link steer navigation anywhere under the app's origin.
 */
function nativeInvitePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isCustomScheme = parsed.protocol === 'studybuddy:' && parsed.host === 'invite';
    const isWebLink =
      parsed.protocol === 'https:' &&
      parsed.host === 'sbd.satym.in' &&
      parsed.pathname.startsWith('/invite');
    if (!isCustomScheme && !isWebLink) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const id = isCustomScheme ? segments[0] : segments[1];
    return id && INVITE_ID_PATTERN.test(id) ? `/invite/${id}` : null;
  } catch {
    return null;
  }
}

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
          // Invite links are checked first because they are unambiguous and cheap,
          // but the auth branch below is untouched: the two URL shapes cannot
          // overlap (`.../auth/callback` versus `.../invite/<id>`).
          const invitePath = nativeInvitePath(url);
          if (invitePath) {
            window.location.assign(invitePath);
            return;
          }
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
