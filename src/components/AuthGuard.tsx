'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { authLoadingAtom, userAtom } from '@/store/atoms';
import LoadingScreen from '@/components/LoadingScreen';

export default function AuthGuard({
  children,
  requireOnboarding = true,
}: {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}) {
  const [user] = useAtom(userAtom);
  const [authLoading] = useAtom(authLoadingAtom);
  const router = useRouter();
  const needsOnboarding = Boolean(user && !('onboardingDone' in user && user.onboardingDone));
  let redirectPath: string | null = null;

  if (!authLoading) {
    if (!user) {
      redirectPath = '/';
    } else if (requireOnboarding && needsOnboarding) {
      redirectPath = '/onboarding';
    } else if (!requireOnboarding && !needsOnboarding) {
      redirectPath = '/dashboard';
    }
  }

  useEffect(() => {
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [redirectPath, router]);

  if (authLoading || redirectPath || !user) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
