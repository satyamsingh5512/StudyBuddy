import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom, userAtom } from '@/store/atoms';
import { 
  Play, 
  Pause, 
  X, 
  Settings, 
  RotateCcw,
  Maximize,
  Minimize
} from 'lucide-react';
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

interface FullscreenTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullscreenTimer({ isOpen, onClose }: FullscreenTimerProps) {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [, setUser] = useAtom(userAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved) : 50;
  });
  const [tempDuration, setTempDuration] = useState(pomodoroDuration);
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { toast } = useToast();

  const POMODORO_DURATION = pomodoroDuration * 60;

  const saveSession = useCallback(async (minutes: number) => {
    if (minutes < 1) return;

    try {
      const res = await apiFetch('/api/timer/session', {
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
    if (!studying) return;

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
  }, [studying, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession]);

  // Handle escape key to exit fullscreen
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
  }, [isOpen, onClose]);

  const toggleStudying = () => {
    setStudying(!studying);
    soundManager.playClick();
  };

  const clearTimer = () => {
    setStudying(false);
    setStudyTime(0);
    soundManager.playClick();
    toast({ title: 'Timer cleared', description: 'Focus session reset' });
  };

  const stopAndSave = () => {
    if (studyTime > 0) {
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) {
        saveSession(minutes);
      }
      setStudying(false);
      setStudyTime(0);
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 flex items-center justify-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.2),transparent_50%)]" />
      </div>

      {/* Controls Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10">
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Focus Timer Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="duration">Focus Duration (minutes)</Label>
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
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-white hover:bg-white/10"
        >
          {isMinimized ? <Maximize className="h-5 w-5" /> : <Minimize className="h-5 w-5" />}
        </Button>

        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Timer Content */}
      <div className={`text-center text-white transition-all duration-300 ${isMinimized ? 'scale-50 opacity-70' : 'scale-100'}`}>
        {/* Timer Display */}
        <div className="mb-8">
          <div className="text-8xl md:text-9xl font-mono font-bold mb-4 tracking-wider">
            {formatTime(studyTime)}
          </div>
          
          {studyTime > 0 && (
            <div className="mb-6">
              <div className="text-xl mb-2">{Math.floor(progress)}% Complete</div>
              <div className="w-96 h-3 bg-white/20 rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-1000 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="mb-8">
          {studying ? (
            <div className="space-y-2">
              <div className="text-2xl font-semibold">Deep Focus Mode</div>
              <div className="text-lg text-white/70">Stay focused, you're doing great!</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-semibold">Ready to Focus</div>
              <div className="text-lg text-white/70">Press spacebar or click play to start</div>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-6">
          <Button
            size="lg"
            onClick={toggleStudying}
            className={`
              w-20 h-20 rounded-full text-2xl transition-all duration-200 hover:scale-110
              ${studying 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
              }
            `}
          >
            {studying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>

          {studyTime > 0 && (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={clearTimer}
                className="w-16 h-16 rounded-full border-white/30 text-white hover:bg-white/10"
              >
                <RotateCcw className="h-6 w-6" />
              </Button>

              <Button
                size="lg"
                onClick={stopAndSave}
                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-lg"
              >
                Save & Exit
              </Button>
            </>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/50 text-sm">
          <div className="flex items-center gap-6">
            <span>SPACE - Play/Pause</span>
            <span>ESC - Exit Fullscreen</span>
          </div>
        </div>
      </div>
    </div>
  );
}