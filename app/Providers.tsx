'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { initTheme } from '@/lib/theme';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import { wakeupServer } from '@/lib/serverWakeup';
import { useNetworkStatus } from '@/lib/networkStatus';
import LoadingScreen from '@/components/LoadingScreen';
import ServerWakeup from '@/components/ServerWakeup';
import Maintenance from '@/components/Maintenance';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState(true);
  const [showWakeup, setShowWakeup] = useState(true);

  useNetworkStatus();

  useEffect(() => {
    initTheme();
    let soundPlayed = false;

    const initializeApp = async () => {
      soundManager.initialize();

      await wakeupServer();
      setShowWakeup(false);

      const timeoutId = window.setTimeout(() => {
        setUser(null);
        setIsLoading(false);
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
          if (data && !soundPlayed) {
            window.setTimeout(() => soundManager.playLogin(), 100);
            soundPlayed = true;
          }
          window.setTimeout(() => setIsLoading(false), 500);
        })
        .catch(() => {
          window.clearTimeout(timeoutId);
          setUser(null);
          window.setTimeout(() => setIsLoading(false), 500);
        });

      return () => window.clearTimeout(timeoutId);
    };

    initializeApp();
  }, [setUser]);

  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return <Maintenance />;
  }

  if (showWakeup) {
    return <ServerWakeup />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
        <Toaster />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
