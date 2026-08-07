'use client';

import { useEffect, useState } from 'react';

const EXAMS = [
  'JEE Advanced 2026',
  'JEE Main 2027',
  'NEET UG 2027',
  'UPSC CSE 2027',
  'GATE 2027',
  'CAT 2026',
  'CUET UG 2027',
] as const;

const ITEM_HEIGHT = 20;
const ROTATION_MS = 2600;

/**
 * A vertical text reel. Only `transform` is animated, so the browser can keep
 * the transition on the compositor without layout or paint work per frame.
 * The timer pauses in background tabs to avoid needless React updates.
 */
export default function ExamRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (document.hidden) return;
      timer = window.setInterval(() => {
        setIndex((current) => (current + 1) % EXAMS.length);
      }, ROTATION_MS);
    };

    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
    };
  }, []);

  return (
    <div
      className="relative h-5 overflow-hidden text-left"
      aria-live="polite"
      aria-label={EXAMS[index]}
    >
      <div
        aria-hidden="true"
        className="will-change-transform motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-brand"
        style={{ transform: `translate3d(0, -${index * ITEM_HEIGHT}px, 0)` }}
      >
        {EXAMS.map((exam) => (
          <div
            key={exam}
            className="h-5 truncate text-[13px] font-medium leading-5 tracking-[-0.01em] text-ink"
          >
            {exam}
          </div>
        ))}
      </div>
    </div>
  );
}
