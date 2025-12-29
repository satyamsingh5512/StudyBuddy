import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
import { Play, Pause, X, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';

interface FullscreenTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullscreenTimer({ isOpen, onClose }: FullscreenTimerProps) {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const { toast } = useToast();

  const pomodoroDuration = parseInt(localStorage.getItem('pomodoroDuration') || '50') * 60;
  const progress = Math.min((studyTime / pomodoroDuration) * 100, 100);

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
        toast({ title: '🎉 Session saved!', description: data.message || `+${minutes} points earned` });
      }
    } catch {
      toast({ title: 'Session saved offline' });
    }
  }, [toast]);

  useEffect(() => {
    if (!isOpen || !studying) return;
    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
        if (newTime >= pomodoroDuration) {
          setStudying(false);
          soundManager.playTimerComplete();
          saveSession(Math.floor(newTime / 60));
          toast({ title: '🎉 Pomodoro Complete!' });
          setStudyTime(0);
          return 0;
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, studying, setStudyTime, pomodoroDuration, toast, setStudying, saveSession]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); setStudying(!studying); soundManager.playClick(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, studying, setStudying]);

  if (!isOpen) return null;

  const toggleStudying = () => { setStudying(!studying); soundManager.playClick(); };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-fuchsia-500/20 rounded-full blur-[120px] animate-float animation-delay-200" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] animate-float animation-delay-400" />
      </div>

      {/* Close Button */}
      <Button variant="ghost" size="icon" onClick={onClose}
        className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card/80 z-10">
        <X className="h-5 w-5" />
      </Button>

      {/* Minimize Button */}
      <Button variant="ghost" size="icon" onClick={onClose}
        className="absolute top-6 left-6 h-12 w-12 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card/80 z-10">
        <Minimize2 className="h-5 w-5" />
      </Button>

      {/* Main Content */}
      <div className="relative flex flex-col items-center gap-12 p-8">
        {/* Circular Progress */}
        <div className="relative">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur-3xl opacity-30 animate-pulse-glow" />
          
          {/* Progress Ring */}
          <svg className="w-80 h-80 sm:w-96 sm:h-96 transform -rotate-90 relative">
            {/* Background Circle */}
            <circle cx="50%" cy="50%" r="45%" strokeWidth="8" fill="transparent"
              className="stroke-muted/20" />
            
            {/* Progress Circle */}
            <circle cx="50%" cy="50%" r="45%" strokeWidth="8" fill="transparent"
              stroke="url(#fullscreenGradient)"
              strokeDasharray={2 * Math.PI * 45 * 4}
              strokeDashoffset={2 * Math.PI * 45 * 4 - (progress / 100) * 2 * Math.PI * 45 * 4}
              strokeLinecap="round"
              className="transition-all duration-1000 drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]"
            />
            
            <defs>
              <linearGradient id="fullscreenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#d946ef" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>

          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl sm:text-8xl font-bold font-mono tracking-tight bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              {formatTime(studyTime)}
            </span>
            <span className="text-xl sm:text-2xl text-muted-foreground mt-2">
              {Math.round(progress)}% complete
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <Button size="lg" onClick={toggleStudying}
            className={`h-20 w-20 rounded-3xl shadow-2xl transition-all duration-300 hover:scale-110 ${
              studying 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30' 
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-500/30'
            }`}>
            {studying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 ml-1" />}
          </Button>
        </div>

        {/* Keyboard Hints */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 font-mono text-xs">Space</kbd>
            <span>Play/Pause</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 font-mono text-xs">Esc</kbd>
            <span>Exit</span>
          </div>
        </div>

        {/* Session Info */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 rounded-full bg-card/50 backdrop-blur-sm border border-border/50">
          <div className={`h-2 w-2 rounded-full ${studying ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-sm font-medium">
            {studying ? 'Focus Mode Active' : 'Paused'}
          </span>
        </div>
      </div>
    </div>
  );
}
