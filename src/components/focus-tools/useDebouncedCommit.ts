'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Coalesces slider movement into one native write.
 *
 * Volume and the two allowance sliders map onto SharedPreferences writes and, in the
 * case of volume, a live audio track. Writing on every pointer move sends hundreds of
 * calls across the Capacitor bridge for one drag, which is what made these controls
 * feel sticky. `schedule` therefore debounces, and `commit` fires immediately so
 * releasing the thumb applies the value without waiting out the delay.
 *
 * The pending value is dropped on unmount rather than flushed: a value the user
 * scrubbed past on their way off the page is not a setting they chose.
 */
export function useDebouncedCommit<T>(
  write: (value: T) => void,
  delayMs = 250
): { schedule: (value: T) => void; commit: (value: T) => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held in a ref so `schedule`/`commit` stay referentially stable even when the
  // caller passes an inline closure, which keeps the memoized sections from
  // re-rendering on every parent render.
  const writeRef = useRef(write);
  writeRef.current = write;

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const schedule = useCallback(
    (value: T) => {
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        writeRef.current(value);
      }, delayMs);
    },
    [clear, delayMs]
  );

  const commit = useCallback(
    (value: T) => {
      clear();
      writeRef.current(value);
    },
    [clear]
  );

  return { schedule, commit };
}
