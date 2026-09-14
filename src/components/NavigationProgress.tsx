'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export const NAVIGATION_START_EVENT = 'studybuddy:navigation-start';

type NavigationEvent = CustomEvent<{ to?: string }>;

/**
 * Small, global route-progress affordance. It acknowledges internal navigation
 * immediately while Next.js loads the next route, then clears as soon as the
 * pathname changes. The timeout is a last-resort guard for same-route clicks or
 * a navigation that is interrupted by the browser.
 */
export function notifyNavigationStart(to: string) {
  if (typeof window === 'undefined' || !to.startsWith('/') || to.startsWith('//')) return;

  window.dispatchEvent(
    new CustomEvent<{ to: string }>(NAVIGATION_START_EVENT, {
      detail: { to },
    })
  );
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const start = (event: Event) => {
      const to = (event as NavigationEvent).detail?.to;
      if (to) {
        const target = new URL(to, window.location.href);
        if (target.pathname === window.location.pathname && target.search === window.location.search) {
          return;
        }
      }

      setPending(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setPending(false), 8000);
    };

    window.addEventListener(NAVIGATION_START_EVENT, start);
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setPending(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname]);

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 overflow-hidden bg-brand/15"
    >
      <div className="h-full w-2/5 animate-[navigation-progress_900ms_ease-in-out_infinite] rounded-full bg-brand" />
    </div>
  );
}
