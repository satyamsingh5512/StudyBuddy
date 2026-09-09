import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Settings
} from 'lucide-react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom, timerSessionStartAtom, userAtom } from '@/store/atoms';
import { Button } from './ui/button';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import FlipClock from './FlipClock';
import { controlDesktopTimer, isDesktopApp } from '@/lib/desktop';

interface FullscreenTimerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSubject?: string;
}

const BREAK_DURATION_SECONDS = 10 * 60;
const LONG_SESSION_BREAK_THRESHOLD_SECONDS = 60 * 60;

export default function FullscreenTimer({ isOpen, onClose, selectedSubject }: FullscreenTimerProps) {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [timerSessionStart, setTimerSessionStart] = useAtom(timerSessionStartAtom);
  const [, setUser] = useAtom(userAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(parsed) && parsed >= 1 && parsed <= 120 ? parsed : 50;
  });
  const [tempDuration, setTempDuration] = useState(pomodoroDuration);
  const [unlimitedTimer, setUnlimitedTimer] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('unlimitedTimer') === 'true';
  });
  const [tempUnlimitedTimer, setTempUnlimitedTimer] = useState(unlimitedTimer);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION_SECONDS);
  const [hasShownBreakRecommendation, setHasShownBreakRecommendation] = useState(false);
  const desktopApp = isDesktopApp();

  // Keep duration and unlimited mode in sync when StudyTimer (or any tab) changes them
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pomodoroDuration' && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
          setPomodoroDuration(parsed);
          setTempDuration(parsed);
        }
      }
      if (e.key === 'unlimitedTimer' && e.newValue !== null) {
        const parsed = e.newValue === 'true';
        setUnlimitedTimer(parsed);
        setTempUnlimitedTimer(parsed);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const { toast } = useToast();

  const POMODORO_DURATION = pomodoroDuration * 60;

  const toggleStudying = useCallback(() => {
    if (isOnBreak) return;

    const next = !studying;
    if (next && !timerSessionStart) {
      setTimerSessionStart(new Date().toISOString());
    }
    setStudying(next);
    soundManager.playClick();
    if (desktopApp) void controlDesktopTimer(next ? 'start' : 'pause');
  }, [desktopApp, isOnBreak, studying, setStudying, timerSessionStart, setTimerSessionStart]);

  const startBreak = useCallback(() => {
    if (isOnBreak) return;

    setStudying(false);
    if (desktopApp) void controlDesktopTimer('pause');
    setIsOnBreak(true);
    setBreakTimeLeft(BREAK_DURATION_SECONDS);
    toast({
      title: 'Break started',
      description: '10-minute break started. Break time has no penalty.',
    });
    soundManager.playClick();
  }, [desktopApp, isOnBreak, setStudying, toast]);

  const endBreakEarly = useCallback(() => {
    if (!isOnBreak) return;

    setIsOnBreak(false);
    setBreakTimeLeft(BREAK_DURATION_SECONDS);
    toast({
      title: 'Break ended',
      description: 'Back to focus mode whenever you are ready.',
    });
    soundManager.playClick();
  }, [isOnBreak, toast]);

  const saveSession = useCallback(async ({
    minutes,
    startTime,
    endTime,
  }: {
    minutes: number;
    startTime?: string;
    endTime?: string;
  }) => {
    if (minutes < 0) return;
    if (!startTime && minutes < 1) return;

    const { enqueueOutbox, newMutationId } = await import('@/lib/offline/outbox');
    const mutationId = newMutationId();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = {
      duration: minutes,
      subject: selectedSubject,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(timezone ? { timezone } : {}),
      clientMutationId: mutationId,
    };

    try {
      const res = await apiFetch('/timer/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Mutation-Id': mutationId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Timer save failed (${res.status})`);
      }

      const data = await res.json();
      const pointsEarned = typeof data.pointsEarned === 'number' ? data.pointsEarned : minutes;
      const durationSaved = typeof data?.session?.duration === 'number' ? data.session.duration : minutes;
      const updatedStreak = typeof data?.streak === 'number' ? data.streak : undefined;

      if (pointsEarned !== 0 || durationSaved !== 0 || typeof updatedStreak === 'number') {
        setUser((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalPoints: (typeof prev.totalPoints === 'number' ? prev.totalPoints : 0) + pointsEarned,
            totalStudyMinutes: (typeof prev.totalStudyMinutes === 'number' ? prev.totalStudyMinutes : 0) + durationSaved,
            ...(typeof updatedStreak === 'number' ? { streak: updatedStreak } : {}),
          };
        });
      }

      if (minutes > 0) {
        toast({
          title: 'Session saved!',
          description: data.message || `+${pointsEarned} points earned`,
        });
      }
      window.dispatchEvent(new CustomEvent('studybuddy:timer-session-saved'));
    } catch (error) {
      console.error('Failed to save session:', error);
      enqueueOutbox({
        id: mutationId,
        type: 'timer-session',
        path: '/timer/session',
        method: 'POST',
        body: payload,
      });
      if (minutes > 0) {
        setUser((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalPoints: (typeof prev.totalPoints === 'number' ? prev.totalPoints : 0) + minutes,
            totalStudyMinutes: (typeof prev.totalStudyMinutes === 'number' ? prev.totalStudyMinutes : 0) + minutes,
          };
        });
      }
      toast({
        title: 'Session saved offline',
        description: 'Stored on this device — will sync when connection is restored',
      });
    }
  }, [setUser, toast, selectedSubject]);

  useEffect(() => {
    if (!isOpen || !isOnBreak) return;

    const breakInterval = setInterval(() => {
      setBreakTimeLeft((prev) => {
        if (prev <= 1) {
          setIsOnBreak(false);
          toast({
            title: 'Break complete',
            description: 'Nice reset. Press play when you are ready to focus again.',
          });
          return BREAK_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(breakInterval);
  }, [isOpen, isOnBreak, toast]);

  useEffect(() => {
    if (!isOpen || isOnBreak || hasShownBreakRecommendation) return;

    if (studyTime >= LONG_SESSION_BREAK_THRESHOLD_SECONDS) {
      setHasShownBreakRecommendation(true);
      toast({
        title: 'Break recommended',
        description: 'You have focused for over 60 minutes. Consider a 10-minute break.',
      });
    }
  }, [studyTime, isOpen, isOnBreak, hasShownBreakRecommendation, toast]);

  useEffect(() => {
    if (studyTime === 0 && hasShownBreakRecommendation) {
      setHasShownBreakRecommendation(false);
    }
  }, [studyTime, hasShownBreakRecommendation]);

  useEffect(() => {
    // The Electron main process is the single timer authority on desktop.
    if (desktopApp || !studying || !isOpen || isOnBreak) return;

    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
        // Unlimited mode: keep counting, never auto-stop or auto-save.
        if (unlimitedTimer) return newTime;
        // Check if Pomodoro completed
        if (newTime >= POMODORO_DURATION) {
          setStudying(false);
          soundManager.playTimerComplete();
          const minutes = Math.floor(newTime / 60);
          const endTime = new Date().toISOString();
          const startTime = timerSessionStart || new Date(Date.now() - (newTime * 1000)).toISOString();
          saveSession({ minutes, startTime, endTime });
          setTimerSessionStart(null);
          toast({
            title: 'Pomodoro Complete! 🎉',
            description: `Excellent focus! You studied for ${pomodoroDuration} minutes.`,
          });
          setStudyTime(0);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [desktopApp, studying, isOpen, isOnBreak, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession, timerSessionStart, setTimerSessionStart, unlimitedTimer]);

  const stopAndSave = useCallback(async () => {
    const currentStudyTime = studyTime;
    const currentSessionStart = timerSessionStart;
    setStudying(false);
    if (desktopApp) await controlDesktopTimer('pause');

    const shouldSaveSession = currentStudyTime > 0 || (!!currentSessionStart && !isOnBreak);

    if (shouldSaveSession) {
      const minutes = Math.floor(currentStudyTime / 60);
      const endTime = new Date().toISOString();
      const startTime = currentSessionStart || new Date(Date.now() - (currentStudyTime * 1000)).toISOString();
      await saveSession({
        minutes,
        startTime,
        endTime,
      });
    }

    setIsOnBreak(false);
    setBreakTimeLeft(BREAK_DURATION_SECONDS);
    setHasShownBreakRecommendation(false);
    setStudyTime(0);
    setTimerSessionStart(null);
    if (desktopApp) await controlDesktopTimer('reset');
    onClose();
  }, [desktopApp, isOnBreak, onClose, saveSession, setStudyTime, setStudying, setTimerSessionStart, studyTime, timerSessionStart]);

  // Handle escape key to exit fullscreen and keep awake logic
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        void stopAndSave();
        return;
      }
      if (e.key === ' ' && isOpen) {
        e.preventDefault();
        if (isOnBreak) return;
        toggleStudying();
      }
      if ((e.key === 'b' || e.key === 'B') && isOpen) {
        e.preventDefault();
        if (isOnBreak) {
          endBreakEarly();
        } else {
          startBreak();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isOnBreak, stopAndSave, toggleStudying, startBreak, endBreakEarly]);

  const activeDurationSeconds = isOnBreak ? BREAK_DURATION_SECONDS : POMODORO_DURATION;
  const elapsedSeconds = isOnBreak ? BREAK_DURATION_SECONDS - breakTimeLeft : studyTime;
  const progress = unlimitedTimer && !isOnBreak ? 0 : Math.min((elapsedSeconds / activeDurationSeconds) * 100, 100);

  const saveDuration = () => {
    const clamped = Math.max(1, Math.min(120, tempDuration));
    setPomodoroDuration(clamped);
    localStorage.setItem('pomodoroDuration', clamped.toString());
    setUnlimitedTimer(tempUnlimitedTimer);
    localStorage.setItem('unlimitedTimer', tempUnlimitedTimer.toString());
    // Notify StudyTimer of the change
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'pomodoroDuration',
      newValue: clamped.toString(),
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'unlimitedTimer',
      newValue: tempUnlimitedTimer.toString(),
    }));
    setShowSettings(false);
    toast({
      title: 'Timer updated',
      description: tempUnlimitedTimer
        ? 'Unlimited mode enabled — the timer will count up with no cap.'
        : `Focus duration set to ${clamped} minutes`,
    });
  };

  // Circular progress calculation
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-background z-[100] overflow-y-auto overscroll-contain"
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen focus timer"
    >
      <div className="min-h-dvh flex flex-col">
        {/* Header: sticky so it never overlaps the clock on short landscape screens */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/90 backdrop-blur border-b border-border/40 shrink-0"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingBottom: '0.75rem',
            paddingLeft: 'max(clamp(1rem, 4vw, 1.5rem), env(safe-area-inset-left))',
            paddingRight: 'max(clamp(1rem, 4vw, 1.5rem), env(safe-area-inset-right))',
          }}
        >
          <div className="text-xs sm:text-sm text-muted-foreground truncate">
            {isOnBreak
              ? 'Break Time • 10 min (no penalty)'
              : unlimitedTimer
                ? 'Focus Session • Unlimited'
                : `Focus Session • ${pomodoroDuration} min`}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" aria-label="Timer settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Timer Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="fs-duration-slider">Focus Duration</Label>
                      <span className="text-2xl font-bold tabular-nums">
                        {tempDuration}<span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                      </span>
                    </div>
                    <Slider
                      id="fs-duration-slider"
                      aria-label="Focus Duration"
                      min={1}
                      max={120}
                      step={1}
                      value={tempDuration}
                      onChange={setTempDuration}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 min</span>
                      <span>30 min</span>
                      <span>60 min</span>
                      <span>90 min</span>
                      <span>120 min</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <Label htmlFor="fs-unlimited-timer-switch">Unlimited timer</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Count up with no fixed duration or auto-stop.
                      </p>
                    </div>
                    <Switch
                      id="fs-unlimited-timer-switch"
                      checked={tempUnlimitedTimer}
                      onCheckedChange={setTempUnlimitedTimer}
                      aria-label="Unlimited timer"
                    />
                  </div>
                  <Button onClick={saveDuration} className="w-full">
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                void stopAndSave();
              }}
              className="min-h-[44px]"
            >
              Save &amp; Exit
            </Button>
          </div>
        </div>

        {/* Main: portrait = stacked; short landscape = two columns so nothing is cut off */}
        <div
          className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 min-h-0 [@media((orientation:landscape)_and_(max-height:500px))]:flex-row [@media((orientation:landscape)_and_(max-height:500px))]:gap-6 [@media((orientation:landscape)_and_(max-height:500px))]:py-3 [@media((orientation:landscape)_and_(max-height:500px))]:items-center"
        >
          {/* Clock column */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 min-w-0 [@media((orientation:landscape)_and_(max-height:500px))]:flex-1">
            <div className="w-full flex justify-center min-w-0">
              <FlipClock
                timeInSeconds={isOnBreak ? breakTimeLeft : (unlimitedTimer ? studyTime : POMODORO_DURATION - studyTime)}
                isCountingDown={!unlimitedTimer || isOnBreak}
              />
            </div>

            <div className="w-full max-w-md px-1">
              {!(unlimitedTimer && !isOnBreak) && (
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {(studyTime > 0 || isOnBreak) && !(unlimitedTimer && !isOnBreak) && (
                <div className="text-xs sm:text-sm tracking-wider text-muted-foreground mt-2 text-center uppercase">
                  {Math.floor(progress)}% complete
                </div>
              )}
              {unlimitedTimer && !isOnBreak && studyTime > 0 && (
                <div className="text-xs sm:text-sm tracking-wider text-muted-foreground mt-2 text-center uppercase">
                  Unlimited session in progress
                </div>
              )}
            </div>
          </div>

          {/* Status + controls column */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 min-w-0 [@media((orientation:landscape)_and_(max-height:500px))]:flex-1 [@media((orientation:landscape)_and_(max-height:500px))]:items-start [@media((orientation:landscape)_and_(max-height:500px))]:text-left">
            <div className="text-center space-y-1.5 [@media((orientation:landscape)_and_(max-height:500px))]:text-left">
              <h2 className="font-semibold" style={{ fontSize: 'clamp(1rem, 2.5vw + 0.5rem, 1.5rem)' }}>
                {isOnBreak ? 'Break Mode Active' : studying ? 'Focus Mode Active' : 'Ready to Focus'}
              </h2>
              <p className="text-muted-foreground" style={{ fontSize: 'clamp(0.8rem, 1.5vw + 0.5rem, 1rem)' }}>
                {isOnBreak
                  ? 'Take a reset. Break time is penalty-free.'
                  : studying
                  ? 'Stay focused and avoid distractions'
                  : 'Press space or click play to begin'
                }
              </p>
              {studyTime >= LONG_SESSION_BREAK_THRESHOLD_SECONDS && !isOnBreak && (
                <p className="text-xs font-medium text-amber-500">
                  You crossed 60 minutes. A 10-minute break is recommended.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap [@media((orientation:landscape)_and_(max-height:500px))]:justify-start">
              <Button
                size="lg"
                onClick={toggleStudying}
                className="rounded-full min-h-[56px] min-w-[56px] sm:min-h-[64px] sm:min-w-[64px]"
                variant={studying ? "destructive" : "default"}
                disabled={isOnBreak}
                aria-label={studying ? 'Pause focus' : 'Start focus'}
              >
                {studying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6" />}
              </Button>

              {isOnBreak ? (
                <Button
                  variant="secondary"
                  onClick={endBreakEarly}
                  className="px-4 sm:px-6 min-h-[44px]"
                >
                  End Break Early
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={startBreak}
                  className="px-4 sm:px-6 min-h-[44px]"
                >
                  Take 10m Break
                </Button>
              )}

              {studyTime > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    void stopAndSave();
                  }}
                  className="px-4 sm:px-6 min-h-[44px]"
                >
                  Save & Exit
                </Button>
              )}
            </div>

            <div className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground text-center [@media((orientation:landscape)_and_(max-height:500px))]:text-left">
              <div className="flex items-center gap-3 sm:gap-4">
                <span>Space - Play/Pause</span>
                <span>B - Toggle Break</span>
                <span>Esc - Save &amp; Exit</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
