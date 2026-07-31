'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import LoadingScreen from '@/components/LoadingScreen';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const [user] = useAtom(userAtom);
  const router = useRouter();
  const pathname = usePathname();
  // Public/legal routes remain renderable regardless of auth bootstrap. Only strict
  // guest entry points redirect once an authenticated user is already known.
  const isStrictGuestPage =
    pathname === '/' || pathname === '/auth' || pathname === '/reset-password';
  const shouldRedirect = Boolean(user && isStrictGuestPage);

  useEffect(() => {
    if (user && shouldRedirect) {
      const needsOnboarding = !('onboardingDone' in user && user.onboardingDone);
      router.replace(needsOnboarding ? '/onboarding' : '/dashboard');
    }
  }, [user, router, shouldRedirect]);

  if (shouldRedirect) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
