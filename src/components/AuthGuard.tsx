'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import LoadingScreen from '@/components/LoadingScreen';

export default function AuthGuard({ 
  children, 
  requireOnboarding = true 
}: { 
  children: React.ReactNode;
  requireOnboarding?: boolean;
}) {
  const [user] = useAtom(userAtom);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    const needsOnboarding = !('onboardingDone' in user && user.onboardingDone);
    
    if (requireOnboarding && needsOnboarding) {
      router.replace('/onboarding');
      return;
    }
    
    if (!requireOnboarding && !needsOnboarding) {
      router.replace('/dashboard');
      return;
    }

    setIsAuthorized(true);
  }, [user, router, requireOnboarding]);

  if (!isAuthorized) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
