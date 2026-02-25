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
import { Input } from './ui/input';
import { Label } from './ui/label';
import FlipClock from './FlipClock';
import { KeepAwake } from '@capacitor-community/keep-awake';

interface FullscreenTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullscreenTimer({ isOpen, onClose }: FullscreenTimerProps) {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [tempDuration, setTempDuration] = useState(pomodoroDuration);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  const POMODORO_DURATION = pomodoroDuration * 60;

  const toggleStudying = useCallback(() => {
    setStudying(!studying);
    soundManager.playClick();
  }, [studying, setStudying]);

  const saveSession = useCallback(async (minutes: number) => {
    if (minutes < 1) return;

    try {
      const res = await apiFetch('/timer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, sessionType: 'fullscreen' }),
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
  }, [toast]);

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
      // Prevent screen locking while running in fullscreen
      KeepAwake.keepAwake().catch(console.error);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
      KeepAwake.allowSleep().catch(console.error);
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
    if (tempDuration >= 1 && tempDuration <= 120) {
      setPomodoroDuration(tempDuration);
      localStorage.setItem('pomodoroDuration', tempDuration.toString());
      setShowSettings(false);
      toast({
        title: 'Timer updated',
        description: `Focus duration set to ${tempDuration} minutes`
      });
    }
  };

  // Circular progress calculation
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-background z-[100] flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-6">
        <div className="text-sm text-muted-foreground">
          Focus Session • {pomodoroDuration} min
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Timer Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="120"
                    value={tempDuration}
                    onChange={(e) => setTempDuration(parseInt(e.target.value, 10) || 1)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveDuration();
                      }
                    }}
                  />
                </div>
                <Button onClick={saveDuration} className="w-full">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center space-y-12 w-full max-w-4xl mx-auto">
        {/* Flip Clock Timer */}
        <div className="scale-75 sm:scale-100 my-8">
          <FlipClock timeInSeconds={POMODORO_DURATION - studyTime} isCountingDown={true} />
        </div>

        {/* Progress Bar under clock */}
        <div className="w-full max-w-md px-6">
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

        {/* Status */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">
            {studying ? 'Focus Mode Active' : 'Ready to Focus'}
          </h2>
          <p className="text-muted-foreground">
            {studying
              ? 'Stay focused and avoid distractions'
              : 'Press space or click play to begin'
            }
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={toggleStudying}
            className="w-16 h-16 rounded-full"
            variant={studying ? "destructive" : "default"}
          >
            {studying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>

          {studyTime > 0 && (
            <Button
              variant="outline"
              onClick={stopAndSave}
              className="px-6"
            >
              Save & Exit
            </Button>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <div className="text-xs text-muted-foreground text-center">
          <div className="flex items-center gap-4">
            <span>Space - Play/Pause</span>
            <span>Esc - Exit</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}