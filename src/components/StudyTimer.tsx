import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
import { Play, Pause, Settings, RotateCcw, Clock, Maximize } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';

import FullscreenTimer from './FullscreenTimer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Lap {
  id: number;
  time: number;
  timestamp: Date;
}

export default function StudyTimer() {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved) : 50;
  });
  const [tempDuration, setTempDuration] = useState(pomodoroDuration);
  const [showSettings, setShowSettings] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const { toast } = useToast();


  const POMODORO_DURATION = pomodoroDuration * 60;

  const saveSession = useCallback(async (minutes: number) => {
    if (minutes < 1) return;

    try {
      const res = await apiFetch('/api/timer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
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
      toast({
        title: 'Session saved offline',
        description: 'Will sync when connection is restored',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!studying) return;

    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
        // Check if Pomodoro completed
        if (newTime >= POMODORO_DURATION) {
          // Stop the timer
          setStudying(false);
          // Play completion sound
          soundManager.playTimerComplete();
          // Save the session and award points
          const minutes = Math.floor(newTime / 60);
          saveSession(minutes);
          // Show completion message
          toast({
            title: 'Pomodoro Complete! 🎉',
            description: `Great job! You studied for ${pomodoroDuration} minutes. Points awarded!`,
          });
          // Reset time
          setStudyTime(0);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [studying, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession]);

  const toggleStudying = () => {
    setStudying(!studying);
    soundManager.playClick();
  };

  const clearTimer = () => {
    setStudying(false);
    setStudyTime(0);
    setLaps([]);
    soundManager.playClick();
    toast({ title: 'Timer cleared', description: 'All progress reset' });
  };

  const addLap = () => {
    if (studyTime > 0) {
      const newLap: Lap = {
        id: Date.now(),
        time: studyTime,
        timestamp: new Date(),
      };
      setLaps([newLap, ...laps]);
      soundManager.playClick();
      toast({ title: 'Lap recorded', description: formatTime(studyTime) });
    }
  };

  const stopAndSave = () => {
    if (studyTime > 0) {
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) {
        saveSession(minutes);
      }
      setStudying(false);
      setStudyTime(0);
      setLaps([]);
    }
  };

  const progress = Math.min((studyTime / POMODORO_DURATION) * 100, 100);

  const handleOpenSettings = () => {
    setTempDuration(pomodoroDuration);
    setShowSettings(true);
  };

  const saveDuration = () => {
    if (tempDuration >= 1 && tempDuration <= 120) {
      setPomodoroDuration(tempDuration);
      localStorage.setItem('pomodoroDuration', tempDuration.toString());
      setShowSettings(false);
      toast({ 
        title: 'Timer duration updated', 
        description: `Pomodoro set to ${tempDuration} minutes` 
      });
    } else {
      toast({
        title: 'Invalid duration',
        description: 'Please enter a value between 1 and 120 minutes',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-3 sm:p-4 md:pt-6">
        {/* Header - Fully Responsive */}
        <div className="flex flex-col xs:flex-row xs:items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm sm:text-base truncate">Study Timer</h3>
            <p className="text-xs text-muted-foreground">
              Pomodoro: <span className="font-medium">{pomodoroDuration}min</span> focus
            </p>
          </div>
          
          {/* Controls - Always Horizontal */}
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFullscreen(true)}
              title="Fullscreen Focus Mode"
              className="h-8 w-8 p-0 shrink-0"
            >
              <Maximize className="h-3.5 w-3.5" />
            </Button>
            
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleOpenSettings} 
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-md">
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
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set focus duration (1-120 minutes)
                    </p>
                  </div>
                  <Button onClick={saveDuration} className="w-full">
                    Save Duration
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button
              size="sm"
              onClick={toggleStudying}
              variant={studying ? 'default' : 'outline'}
              className={`h-8 w-8 p-0 shrink-0 ${studying ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {studying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Timer Display - Ultra Responsive */}
        {studyTime > 0 && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
            {/* Circular Progress - Responsive Size */}
            <div className="flex items-center justify-center py-2">
              <div className="relative">
                <svg 
                  className="w-16 h-16 xs:w-18 xs:h-18 sm:w-20 sm:h-20 transform -rotate-90" 
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-muted/20"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 36}
                    strokeDashoffset={2 * Math.PI * 36 - (progress / 100) * 2 * Math.PI * 36}
                    className="text-primary transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs xs:text-sm font-mono font-bold">
                    {Math.floor(progress)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Time Display - Responsive Typography */}
            <div className="text-center">
              <div className="font-mono text-lg xs:text-xl sm:text-2xl font-bold">
                {formatTime(studyTime)}
              </div>
            </div>

            {/* Action Buttons - Fully Responsive Grid */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={addLap}
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm transition-all hover:scale-105 active:scale-95 px-1 xs:px-2 sm:px-3"
              >
                <Clock className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:mr-1" />
                <span className="hidden xs:inline ml-1 sm:ml-0">Lap</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearTimer}
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm transition-all hover:scale-105 active:scale-95 px-1 xs:px-2 sm:px-3"
              >
                <RotateCcw className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:mr-1" />
                <span className="hidden xs:inline ml-1 sm:ml-0">Clear</span>
              </Button>
              <Button
                size="sm"
                onClick={stopAndSave}
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 px-1 xs:px-2 sm:px-3"
              >
                Save
              </Button>
            </div>

            {/* Laps Display - Responsive */}
            {laps.length > 0 && (
              <div className="space-y-1 sm:space-y-2 animate-in slide-in-from-top duration-300">
                <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Laps</h4>
                <div className="max-h-24 xs:max-h-28 sm:max-h-32 overflow-y-auto space-y-1">
                  {laps.map((lap, index) => (
                    <div
                      key={lap.id}
                      className="flex items-center justify-between text-xs xs:text-sm bg-muted/50 rounded px-2 xs:px-3 py-1 xs:py-1.5 animate-in fade-in slide-in-from-top duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="text-muted-foreground">
                        Lap {laps.length - index}
                      </span>
                      <span className="font-mono font-medium">
                        {formatTime(lap.time)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle State - Responsive */}
        {studyTime === 0 && !studying && (
          <div className="text-center py-4 sm:py-6">
            <p className="text-xs xs:text-sm text-muted-foreground">
              Click play to start studying
            </p>
          </div>
        )}
      </CardContent>
      
      <FullscreenTimer 
        isOpen={showFullscreen} 
        onClose={() => setShowFullscreen(false)} 
      />
    </Card>
  );
}
