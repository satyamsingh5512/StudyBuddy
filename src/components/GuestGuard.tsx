'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import LoadingScreen from '@/components/LoadingScreen';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const [user] = useAtom(userAtom);
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // We only want to auto-redirect from auth pages if user is already logged in
    // But some public pages (like /about, /terms) should be accessible even if logged in.
    const isStrictGuestPage = pathname === '/' || pathname === '/auth' || pathname === '/reset-password';

    if (user && isStrictGuestPage) {
      const needsOnboarding = !('onboardingDone' in user && user.onboardingDone);
      router.replace(needsOnboarding ? '/onboarding' : '/dashboard');
      return;
    }

    setIsAuthorized(true);
  }, [user, router, pathname]);

  if (!isAuthorized) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
