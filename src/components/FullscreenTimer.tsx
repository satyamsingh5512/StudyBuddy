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
import FlipClock from './FlipClock';

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
  const [showSettings, setShowSettings] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION_SECONDS);
  const [hasShownBreakRecommendation, setHasShownBreakRecommendation] = useState(false);

  // Keep duration in sync when StudyTimer (or any tab) changes it
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pomodoroDuration' && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
          setPomodoroDuration(parsed);
          setTempDuration(parsed);
        }
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
  }, [isOnBreak, studying, setStudying, timerSessionStart, setTimerSessionStart]);

  const startBreak = useCallback(() => {
    if (isOnBreak) return;

    setStudying(false);
    setIsOnBreak(true);
    setBreakTimeLeft(BREAK_DURATION_SECONDS);
    toast({
      title: 'Break started',
      description: '10-minute break started. Break time has no penalty.',
    });
    soundManager.playClick();
  }, [isOnBreak, setStudying, toast]);

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

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      // In fullscreen mode, we might not have selectedSubject locally, but we can pass a default or keep it undefined
      const res = await apiFetch('/timer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: minutes,
          subject: selectedSubject,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
          ...(timezone ? { timezone } : {}),
        }),
      });

      if (res.ok) {
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
      }
    } catch (error) {
      console.error('Failed to save session:', error);
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
    if (!studying || !isOpen || isOnBreak) return;

    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
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
  }, [studying, isOpen, isOnBreak, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession, timerSessionStart, setTimerSessionStart]);

  const stopAndSave = useCallback(async () => {
    const currentStudyTime = studyTime;
    const currentSessionStart = timerSessionStart;
    setStudying(false);

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
    onClose();
  }, [isOnBreak, onClose, saveSession, setStudyTime, setStudying, setTimerSessionStart, studyTime, timerSessionStart]);

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
  const progress = Math.min((elapsedSeconds / activeDurationSeconds) * 100, 100);

  const saveDuration = () => {
    const clamped = Math.max(1, Math.min(120, tempDuration));
    setPomodoroDuration(clamped);
    localStorage.setItem('pomodoroDuration', clamped.toString());
    // Notify StudyTimer of the change
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'pomodoroDuration',
      newValue: clamped.toString(),
    }));
    setShowSettings(false);
    toast({
      title: 'Timer updated',
      description: `Focus duration set to ${clamped} minutes`,
    });
  };

  // Circular progress calculation
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-background z-[100] flex items-center justify-center">
      {/* Header - RESPONSIVE FIX: Fluid padding and text */}
      <div className="absolute top-4 sm:top-6 left-0 right-0 flex items-center justify-between" style={{ paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
        <div className="text-xs sm:text-sm text-muted-foreground">
          {isOnBreak ? 'Break Time • 10 min (no penalty)' : `Focus Session • ${pomodoroDuration} min`}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              {/* RESPONSIVE FIX: Touch target min 44x44px */}
              <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]">
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
                  <input
                    id="fs-duration-slider"
                    type="range"
                    min="1"
                    max="120"
                    step="1"
                    value={tempDuration}
                    onChange={(e) => setTempDuration(parseInt(e.target.value, 10))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-muted"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 min</span>
                    <span>30 min</span>
                    <span>60 min</span>
                    <span>90 min</span>
                    <span>120 min</span>
                  </div>
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

      {/* Main Content - RESPONSIVE FIX: Fluid spacing */}
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto" style={{ gap: 'clamp(2rem, 6vw, 3rem)', paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
        {/* Flip Clock Timer - RESPONSIVE FIX: Scale for mobile */}
        <div className="scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 my-4 sm:my-8">
          <FlipClock timeInSeconds={isOnBreak ? breakTimeLeft : POMODORO_DURATION - studyTime} isCountingDown={true} />
        </div>

        {/* Progress Bar under clock - RESPONSIVE FIX: Fluid width */}
        <div className="w-full max-w-md" style={{ paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
          <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {(studyTime > 0 || isOnBreak) && (
            <div className="text-sm tracking-wider text-muted-foreground mt-3 text-center uppercase">
              {Math.floor(progress)}% complete
            </div>
          )}
        </div>

        {/* Status - RESPONSIVE FIX: Fluid text */}
        <div className="text-center space-y-2">
          <h2 className="font-semibold" style={{ fontSize: 'clamp(1.125rem, 3vw, 1.5rem)' }}>
            {isOnBreak ? 'Break Mode Active' : studying ? 'Focus Mode Active' : 'Ready to Focus'}
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
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

        {/* Controls - RESPONSIVE FIX: Touch targets min 44x44px */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={toggleStudying}
            className="rounded-full min-h-[56px] min-w-[56px] sm:min-h-[64px] sm:min-w-[64px]"
            variant={studying ? "destructive" : "default"}
            disabled={isOnBreak}
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

        {/* Keyboard Shortcuts - RESPONSIVE FIX: Smaller text on mobile */}
        <div className="text-[10px] sm:text-xs text-muted-foreground text-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <span>Space - Play/Pause</span>
            <span>B - Toggle Break</span>
            <span>Esc - Save &amp; Exit</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
