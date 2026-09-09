'use client';

/**
 * FocusGuard — cross-device phone-interrupt enforcement.
 *
 * Scenario: you start a focus timer on your laptop (web). You then pick up
 * your phone (APK or mobile browser). This component polls the backend for a
 * live focus session owned by ANOTHER device and shows a full-screen guard:
 *   "You're on a focus session — put your phone down."
 *
 * Exemption (your rule): if THIS device is itself running the timer — the
 * floating clock widget or fullscreen timer (studying / timerSessionStart) —
 * the guard never appears. Using the same app is always allowed.
 *
 * Auto-stop: if the guard stays visible for GRACE_MS (2.5 min) without the
 * user starting a local timer, the remote session is ended automatically
 * (`phone-interrupt`) so stats stay honest. A 60s snooze is offered for
 * genuine urgent use.
 *
 * Platform honesty: a web app cannot lock the OS. Inside the Capacitor APK
 * this overlay + local notification + keep-awake is the strongest available
 * signal short of Device-Owner MDM. Full device lock would need UsageStats /
 * Accessibility native plugins (documented in docs/android-apk.md).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { studyingAtom, timerSessionStartAtom, userAtom } from '@/store/atoms';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  announceFocusEnd,
  announceFocusStart,
  fetchRemoteFocus,
  interruptRemoteFocus,
  myDeviceId,
  sendFocusHeartbeat,
  type RemoteFocusState,
} from '@/lib/focusSession';
import { hapticNotify } from '@/lib/capacitor';

const POLL_MS = 20_000;
const GRACE_MS = 150_000; // 2.5 min of phone use → auto-stop remote focus
const SNOOZE_MS = 60_000;

export default function FocusGuard() {
  const user = useAtomValue(userAtom);
  const studying = useAtomValue(studyingAtom);
  const timerSessionStart = useAtomValue(timerSessionStartAtom);
  const { toast } = useToast();

  const [remote, setRemote] = useState<RemoteFocusState>({ active: false });
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [ending, setEnding] = useState(false);

  const localEngaged = studying || timerSessionStart !== null;
  const guardVisible =
    !!user && remote.active && !remote.isMine && !localEngaged && snoozedUntil === 0;

  const firstSeenRef = useRef<number>(0);
  const announcedRef = useRef(false);
  const pollVersionRef = useRef(0);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // --- Announce OUR OWN local timer so other devices guard themselves ---
  useEffect(() => {
    if (!user) {
      announcedRef.current = false;
      return;
    }
    if (timerSessionStart && !announcedRef.current) {
      announcedRef.current = true;
      void announceFocusStart(undefined, undefined);
    }
    if (!timerSessionStart && announcedRef.current) {
      announcedRef.current = false;
      void announceFocusEnd('completed');
    }
  }, [user, timerSessionStart]);

  // --- Heartbeat while OUR timer runs ---
  useEffect(() => {
    if (!user || !timerSessionStart) return;
    const id = window.setInterval(() => void sendFocusHeartbeat(), POLL_MS);
    return () => window.clearInterval(id);
  }, [user, timerSessionStart]);

  const poll = useCallback(async () => {
    const requestVersion = ++pollVersionRef.current;
    if (!user) return;
    // No need to poll while we ourselves are the active focus owner.
    if (timerSessionStart) {
      setRemote({ active: false });
      return;
    }
    const state = await fetchRemoteFocus();
    // A slow poll must not resurrect a session that was ended locally after
    // the request started.
    if (requestVersion !== pollVersionRef.current) return;
    setRemote(state);
  }, [user, timerSessionStart]);

  // --- Poll remote focus (other devices) ---
  useEffect(() => {
    if (!user) return;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('studybuddy:app-resumed', onVisible);
    const onFocusChanged = () => void poll();
    window.addEventListener('studybuddy:focus-changed', onFocusChanged);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('studybuddy:app-resumed', onVisible);
      window.removeEventListener('studybuddy:focus-changed', onFocusChanged);
    };
  }, [user, poll]);

  // --- Snooze is timer-driven so render stays pure and the guard re-arms reliably. ---
  useEffect(() => {
    if (!snoozedUntil) return;
    const wait = Math.max(0, snoozedUntil - Date.now());
    const id = window.setTimeout(() => setSnoozedUntil(0), wait);
    return () => window.clearTimeout(id);
  }, [snoozedUntil]);

  // --- Grace timer → auto-stop after 2–3 min of phone use ---
  useEffect(() => {
    if (!guardVisible) {
      firstSeenRef.current = 0;
      setElapsedMs(0);
      return;
    }
    if (!firstSeenRef.current) {
      firstSeenRef.current = Date.now();
      void hapticNotify();
      toastRef.current({
        title: '🔒 Focus session is live',
        description: 'Put your phone down — your timer is running on another device.',
        duration: 6000,
      });
    }
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - firstSeenRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= GRACE_MS) {
        window.clearInterval(tick);
        setEnding(true);
        pollVersionRef.current += 1;
        void interruptRemoteFocus().finally(() => {
          pollVersionRef.current += 1;
          setRemote({ active: false });
          setEnding(false);
          toastRef.current({
            title: 'Focus session stopped',
            description: 'Phone was used for over 2 minutes during focus. Session ended.',
            variant: 'destructive',
          });
        });
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [guardVisible]);

  if (!guardVisible) return null;

  const remainingSec = Math.max(0, Math.ceil((GRACE_MS - elapsedMs) / 1000));
  const mm = Math.floor(remainingSec / 60);
  const ss = String(remainingSec % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Focus session guard"
      style={{ height: '100dvh' }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-950 p-6 text-center text-white shadow-2xl space-y-4">
        <div className="text-5xl" aria-hidden>
          🔒
        </div>
        <h2 className="text-xl font-bold">You&apos;re on a focus session</h2>
        <p className="text-sm text-zinc-300">
          {remote.subject ? (
            <>
              <span className="font-semibold text-white">{remote.subject}</span> is in progress{' '}
            </>
          ) : (
            <>Your timer is running </>
          )}
          on another device. Put your phone down and get back to work.
        </p>
        <p className="text-xs text-amber-300 font-mono" aria-live="polite">
          Auto-stops focus in {mm}:{ss} if you keep using your phone
        </p>
        <div className="grid gap-2">
          <Button
            className="w-full min-h-[48px]"
            onClick={() => {
              // "Return to focus": user puts phone away; snooze briefly so the
              // overlay doesn't fight them, then re-arms automatically.
              setSnoozedUntil(Date.now() + SNOOZE_MS);
              toast({
                title: 'Good choice 🎯',
                description: 'Lock your phone and focus. I’ll check again in a minute.',
              });
            }}
          >
            I&apos;m putting my phone away
          </Button>
          <Button
            variant="secondary"
            className="w-full min-h-[48px]"
            onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}
          >
            Snooze 1 min (urgent use)
          </Button>
          <Button
            variant="destructive"
            className="w-full min-h-[48px]"
            disabled={ending}
            onClick={() => {
              setEnding(true);
              pollVersionRef.current += 1;
              void interruptRemoteFocus().finally(() => {
                setRemote({ active: false });
                setEnding(false);
              });
            }}
          >
            {ending ? 'Ending…' : 'End focus session now'}
          </Button>
        </div>
        <p className="text-[11px] text-zinc-500">
          Tip: open the StudyBuddy timer on this phone instead — using the same app never triggers
          this warning. Device {myDeviceId().slice(0, 8)}…
        </p>
      </div>
    </div>
  );
}
