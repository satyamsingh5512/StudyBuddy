'use client';

import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { initTheme } from '@/lib/theme';
import { useAtom } from 'jotai';
import { authLoadingAtom, userAtom } from '@/store/atoms';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import { useNetworkStatus } from '@/lib/networkStatus';
import Maintenance from '@/components/Maintenance';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import PwaManager from '@/components/PwaManager';
import { applyAppearancePreferences } from '@/lib/preferences';

export function Providers({ children }: { children: React.ReactNode }) {
  const [, setUser] = useAtom(userAtom);
  const [, setAuthLoading] = useAtom(authLoadingAtom);

  useNetworkStatus();

  useEffect(() => {
    initTheme();
    let soundPlayed = false;

    const initializeApp = async () => {
      soundManager.initialize();

      const timeoutId = window.setTimeout(() => {
        setUser(null);
        setAuthLoading(false);
      }, 10000);

      apiFetch('/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          window.clearTimeout(timeoutId);
          const cleanUser = data
            ? {
                ...data,
                totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
                streak: typeof data.streak === 'number' ? data.streak : 0,
              }
            : null;
          setUser(cleanUser);
          if (cleanUser) applyAppearancePreferences(cleanUser.preferences);
          if (data && !soundPlayed) {
            window.setTimeout(() => soundManager.playLogin(), 100);
            soundPlayed = true;
          }
          setAuthLoading(false);
        })
        .catch(() => {
          window.clearTimeout(timeoutId);
          setUser(null);
          setAuthLoading(false);
        });

      return () => window.clearTimeout(timeoutId);
    };

    initializeApp();
  }, [setAuthLoading, setUser]);

  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return <Maintenance />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
        <PwaManager />
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
