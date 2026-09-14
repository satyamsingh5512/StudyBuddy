'use client';

import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { initTheme } from '@/lib/theme';
import { useAtom } from 'jotai';
import { authLoadingAtom, userAtom } from '@/store/atoms';
import { apiFetchJSON } from '@/config/api';
import {
  clearOfflineAccountData,
  offlineAccountId,
  rememberOfflineAccount,
  saveSnapshot,
} from '@/lib/offline/storage';
import { soundManager } from '@/lib/sounds';
import { useNetworkStatus } from '@/lib/networkStatus';
import Maintenance from '@/components/Maintenance';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import PwaManager from '@/components/PwaManager';
import NativeAppBridge from '@/components/NativeAppBridge';
import OfflineIndicator from '@/components/OfflineIndicator';
import FocusGuard from '@/components/FocusGuard';
import RealtimeSyncBridge from '@/components/RealtimeSyncBridge';
import { applyAppearancePreferences } from '@/lib/preferences';
import NavigationProgress from '@/components/NavigationProgress';

export function Providers({ children }: { children: React.ReactNode }) {
  const [, setUser] = useAtom(userAtom);
  const [, setAuthLoading] = useAtom(authLoadingAtom);

  useNetworkStatus();

  useEffect(() => {
    initTheme();
    soundManager.initialize();

    let cancelled = false;
    let soundPlayed = false;
    let loginSoundTimeoutId: number | undefined;

    // Fallback so a hung or blocked request cannot leave the app on its auth
    // loading screen forever. Cleared on both settle paths and on unmount.
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setUser(null);
      setAuthLoading(false);
    }, 10000);

    const loadAuth = async () => {
      // A saved profile may only bootstrap while the browser remembers an
      // explicit signed-in account. Logout removes that marker and snapshots,
      // so airplane mode can never reopen a previous account after sign-out.
      if (!navigator.onLine && !offlineAccountId()) {
        window.clearTimeout(timeoutId);
        if (!cancelled) {
          setUser(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const data = await apiFetchJSON<any>('/auth/me');
        if (cancelled) return;
        const cleanUser = data
          ? {
              ...data,
              totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
              streak: typeof data.streak === 'number' ? data.streak : 0,
            }
          : null;

        const previousAccount = offlineAccountId();
        if (
          cleanUser &&
          typeof cleanUser.id === 'string' &&
          previousAccount &&
          previousAccount !== cleanUser.id
        ) {
          // A new server-authenticated account has replaced the remembered one.
          // Drop every old snapshot/outbox entry before caching the new profile.
          await clearOfflineAccountData();
        }
        if (cleanUser && typeof cleanUser.id === 'string') {
          rememberOfflineAccount(cleanUser.id);
          saveSnapshot('api:get:/auth/me', cleanUser);
        }

        window.clearTimeout(timeoutId);
        if (cancelled) return;
        setUser(cleanUser);
        if (cleanUser) applyAppearancePreferences(cleanUser.preferences);
        if (cleanUser && !soundPlayed) {
          loginSoundTimeoutId = window.setTimeout(() => soundManager.playLogin(), 100);
          soundPlayed = true;
        }
        setAuthLoading(false);
      } catch (error) {
        window.clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : String(error || '');
        // A confirmed unauthenticated response must not leave an old offline
        // profile eligible for a later offline bootstrap.
        if (navigator.onLine && /unauthorized|unauthenticated|invalid session/i.test(message)) {
          await clearOfflineAccountData();
        }
        if (!cancelled) {
          setUser(null);
          setAuthLoading(false);
        }
      }
    };

    void loadAuth();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (loginSoundTimeoutId !== undefined) {
        window.clearTimeout(loginSoundTimeoutId);
      }
    };
  }, [setAuthLoading, setUser]);

  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return <Maintenance />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <NavigationProgress />
        {children}
        <PwaManager />
        <NativeAppBridge />
        <RealtimeSyncBridge />
        <OfflineIndicator />
        <FocusGuard />
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
