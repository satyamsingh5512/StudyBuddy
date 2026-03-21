import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  X,
  Settings
} from 'lucide-react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
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

export default function FullscreenTimer({ isOpen, onClose, selectedSubject }: FullscreenTimerProps) {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(parsed) && parsed >= 1 && parsed <= 120 ? parsed : 50;
  });
  const [tempDuration, setTempDuration] = useState(pomodoroDuration);
  const [showSettings, setShowSettings] = useState(false);

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
    setStudying(!studying);
    soundManager.playClick();
  }, [studying, setStudying]);

  const saveSession = useCallback(async (minutes: number) => {
    if (minutes < 1) return;

    try {
      // In fullscreen mode, we might not have selectedSubject locally, but we can pass a default or keep it undefined
      const res = await apiFetch('/timer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: minutes, subject: selectedSubject }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Session saved!',
          description: data.message || `+${minutes} points earned`,
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [toast, selectedSubject]);

  useEffect(() => {
    if (!studying || !isOpen) return;

    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
        // Check if Pomodoro completed
        if (newTime >= POMODORO_DURATION) {
          setStudying(false);
          soundManager.playTimerComplete();
          const minutes = Math.floor(newTime / 60);
          saveSession(minutes);
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
  }, [studying, isOpen, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession]);

  // Handle escape key to exit fullscreen and keep awake logic
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (e.key === ' ' && isOpen) {
        e.preventDefault();
        toggleStudying();
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
  }, [isOpen, onClose, toggleStudying]);

  const stopAndSave = () => {
    if (studyTime > 0) {
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) {
        saveSession(minutes);
      }
      setStudying(false);
      setStudyTime(0);
    }
    onClose();
  };

  const progress = Math.min((studyTime / POMODORO_DURATION) * 100, 100);

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
          Focus Session • {pomodoroDuration} min
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
          <Button size="icon" variant="ghost" onClick={onClose} className="min-h-[44px] min-w-[44px]">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content - RESPONSIVE FIX: Fluid spacing */}
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto" style={{ gap: 'clamp(2rem, 6vw, 3rem)', paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
        {/* Flip Clock Timer - RESPONSIVE FIX: Scale for mobile */}
        <div className="scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 my-4 sm:my-8">
          <FlipClock timeInSeconds={POMODORO_DURATION - studyTime} isCountingDown={true} />
        </div>

        {/* Progress Bar under clock - RESPONSIVE FIX: Fluid width */}
        <div className="w-full max-w-md" style={{ paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
          <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {studyTime > 0 && (
            <div className="text-sm tracking-wider text-muted-foreground mt-3 text-center uppercase">
              {Math.floor(progress)}% complete
            </div>
          )}
        </div>

        {/* Status - RESPONSIVE FIX: Fluid text */}
        <div className="text-center space-y-2">
          <h2 className="font-semibold" style={{ fontSize: 'clamp(1.125rem, 3vw, 1.5rem)' }}>
            {studying ? 'Focus Mode Active' : 'Ready to Focus'}
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
            {studying
              ? 'Stay focused and avoid distractions'
              : 'Press space or click play to begin'
            }
          </p>
        </div>

        {/* Controls - RESPONSIVE FIX: Touch targets min 44x44px */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={toggleStudying}
            className="rounded-full min-h-[56px] min-w-[56px] sm:min-h-[64px] sm:min-w-[64px]"
            variant={studying ? "destructive" : "default"}
          >
            {studying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          {studyTime > 0 && (
            <Button
              variant="outline"
              onClick={stopAndSave}
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
            <span>Esc - Exit</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
