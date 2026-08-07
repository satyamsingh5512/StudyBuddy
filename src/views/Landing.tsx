'use client';

import type { CSSProperties } from 'react';
import { useAtomValue } from 'jotai';
import { BlurBlobs } from '@/components/ui/blur-blobs';
import ExamRotator from '@/components/landing/ExamRotator';
import { Link } from '@/lib/router';
import { userAtom } from '@/store/atoms';

/**
 * Landing — single-screen StudyBuddy hero.
 *
 * Reveal cadence:
 *   headline (200ms) → subcopy (400ms) → CTAs (500ms) → week-strip card (700ms)
 * Each element fades in and rises 16px over 700ms on `cubic-bezier(.16,1,.3,1)`.
 * The stagger runs out of DOM order on purpose — the headline lands first and
 * the preview card settles last, which is what makes the entrance feel unhurried.
 *
 * The entrance is a CSS animation rather than a hydration-gated class flip, so
 * the hero is visible on first paint even if JS never runs.
 *
 * The previous long marketing page (HeroSection / FeaturesSection / StatsSection /
 * FAQSection) still exists under src/components/landing; it is just no longer
 * mounted here.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Illustrative streak for the preview card: three days done, today active. */
const PREVIEW_DAYS = [
  { date: 16, state: 'done' },
  { date: 17, state: 'done' },
  { date: 18, state: 'done' },
  { date: 19, state: 'today' },
  { date: 20, state: 'idle' },
  { date: 21, state: 'idle' },
  { date: 22, state: 'idle' },
] as const;

const CELL_STATE: Record<(typeof PREVIEW_DAYS)[number]['state'], string> = {
  done: 'border-transparent bg-brand text-on-accent',
  today: 'border-hairline-accent-strong bg-brand-subtle text-brand',
  idle: 'border-hairline bg-ink/[0.02] text-muted-ink',
};

export default function Landing() {
  const user = useAtomValue(userAtom);

  /**
   * Props for a staggered element. `.reveal` is a pure CSS animation, so the
   * entrance plays on first paint with no hydration dependency; the delay rides
   * an inline custom property because Tailwind cannot scan dynamic class names.
   */
  const reveal = (delayMs: number, extra = '') => ({
    className: `reveal ${extra}`.trim(),
    style: { '--reveal-delay': `${delayMs}ms` } as CSSProperties,
  });

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-surface px-6 py-8 sm:py-12">
      <BlurBlobs />

      <div className="relative z-10 flex w-full max-w-[920px] flex-col items-center text-center">
        {/* Week-strip preview — the product's core object, shown before any copy. */}
        <div {...reveal(700, 'flex w-full justify-center')}>
          <div className="w-3/4 max-w-[420px] rounded-2xl border border-hairline bg-ink/[0.02] p-4">
            <div className="mb-3 h-5">
              <ExamRotator />
            </div>

            <div className="mb-[3px] grid grid-cols-7 gap-[3px]">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-0.5 text-center text-[9px] text-muted-ink">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-[3px]">
              {PREVIEW_DAYS.map((day) => (
                <div
                  key={day.date}
                  className={`flex aspect-square items-center justify-center overflow-hidden rounded-[16.667%] border transition-all ${CELL_STATE[day.state]}`}
                >
                  <span className="text-[9px]">{day.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h1
          {...reveal(
            200,
            'mt-6 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] text-ink sm:mt-10 sm:text-[40px] lg:text-[48px]'
          )}
        >
          Crack your biggest exam.
        </h1>

        <p
          {...reveal(
            400,
            'mt-4 text-[15px] tracking-[-0.01em] text-muted-ink sm:text-[17px]'
          )}
        >
          StudyBuddy helps you show up every day.
        </p>

        <div {...reveal(500, 'mt-6 w-full max-w-[340px] sm:mt-10')}>
          {user ? (
            <Link
              to="/dashboard"
              className="press flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-4 py-3.5 text-[15px] font-medium text-on-accent hover:brightness-110"
            >
              Open my dashboard
            </Link>
          ) : (
            <>
              {/* Full-page navigation, not a router link: OAuth leaves the SPA. */}
              <a
                href="/api/auth/google"
                className="press flex w-full items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-[15px] font-medium text-ink hover:bg-ink/[0.03]"
              >
                <GoogleMark />
                Continue with Google
              </a>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-[13px] text-muted-ink">or</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <Link
                to="/auth"
                className="press flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-4 py-3.5 text-[15px] font-medium text-on-accent hover:brightness-110"
              >
                Continue
              </Link>

              <p className="mt-6 text-[13px] text-muted-ink">
                Already have an account?{' '}
                <Link to="/auth" className="text-brand underline-offset-4 hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="relative z-10 mt-12 flex flex-wrap items-center justify-center gap-x-2 text-[12px] text-muted-ink">
        <span>StudyBuddy</span>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className="hover:text-ink">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/support" className="hover:text-ink">
          Support
        </Link>
      </footer>
    </main>
  );
}

/** Google's four-colour mark. Inline so the button needs no network asset. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
