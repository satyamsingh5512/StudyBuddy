import { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, Settings, RotateCcw, Clock, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';
import { Capacitor } from '@capacitor/core';

// True when running inside the Capacitor Android/iOS shell
const isNative = Capacitor.isNativePlatform();

// Lazy-load the native plugin only on native platforms
const getNativeTimer = () => {
  if (!isNative) return null;
  try { return (window as any).Capacitor?.Plugins?.StudyTimer ?? null; }
  catch { return null; }
};

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
  const [isExpanded, setIsExpanded] = useState(false);
  // OPTIMIZATION: Lazy state initialization - only reads localStorage once
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    if (typeof window === 'undefined') return 50;
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved, 10) : 50;
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
      const res = await apiFetch('/timer/session', {
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
    if (!studying || showFullscreen) return;

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
  }, [studying, showFullscreen, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession]);

  // ── Native timer event listeners (Android only) ─────────────────────────
  useEffect(() => {
    if (!isNative) return;
    const plugin = getNativeTimer();
    if (!plugin) return;

    // Sync UI from native tick
    const tickHandle = plugin.addListener?.('timerTick', ({ secondsLeft }: { secondsLeft: number }) => {
      setStudyTime(pomodoroDuration * 60 - secondsLeft);
    });

    // Handle native timer completion
    const doneHandle = plugin.addListener?.('timerDone', () => {
      setStudying(false);
      soundManager.playTimerComplete();
      saveSession(pomodoroDuration);
      setStudyTime(0);
      toast({ title: 'Pomodoro Complete! 🎉', description: `You studied for ${pomodoroDuration} minutes!` });
    });

    return () => {
      tickHandle?.remove?.();
      doneHandle?.remove?.();
    };
  }, [isNative, pomodoroDuration, setStudyTime, setStudying, saveSession, toast]);

  const toggleStudying = () => {
    const next = !studying;
    setStudying(next);
    soundManager.playClick();

    // On native Android, delegate to the foreground service
    if (isNative) {
      const plugin = getNativeTimer();
      if (plugin) {
        if (next) {
          plugin.startTimer({ duration: (POMODORO_DURATION - studyTime) });
        } else {
          plugin.pauseTimer();
        }
      }
    }
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

  const stopAndSave = async () => {
    // Stop native service (Android) - dismisses the notification
    if (isNative) {
      const plugin = getNativeTimer();
      plugin?.stopTimer();
    }
    if (studyTime > 0) {
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) {
        await saveSession(minutes);
      }
      setStudying(false);
      setStudyTime(0);
      setLaps([]);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

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
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="collapsed-button"
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25
            }}
            className="relative cursor-grab active:cursor-grabbing"
          >
            <Button
              onClick={toggleExpanded}
              size="icon"
              className="h-12 w-12 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-xl border border-white/20 shadow-sm hover:shadow-md hover:bg-white/90 dark:hover:bg-black/60 transition-all duration-200"
              title="Open Pomodoro Timer"
            >
              <Clock className="h-5 w-5 text-foreground" />
            </Button>
            {/* Minimal active indicator */}
            {studying && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border border-white dark:border-gray-900 shadow-sm"></div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="expanded-card"
            drag
            dragMomentum={false}
            whileDrag={{ cursor: 'grabbing' }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 1
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <Card className="w-80 shadow-lg">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">Pomodoro Timer</h3>
                      <p className="text-xs text-muted-foreground">
                        {pomodoroDuration}min sessions
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleExpanded}
                    className="h-8 w-8 p-0"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>

                {/* Timer Display */}
                <div className="text-center mb-4">
                  <div className="text-3xl font-mono font-bold mb-1">
                    {studying ? formatTime(studyTime) : (studyTime > 0 ? formatTime(studyTime) : `${pomodoroDuration}:00`)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {studying ? 'Studying now' : (studyTime > 0 ? 'Paused' : 'Ready to start')}
                  </p>
                </div>

                {/* Progress Bar */}
                {studyTime > 0 && (
                  <div className="mb-4">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min((studyTime / POMODORO_DURATION) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-center mt-1 text-muted-foreground">
                      {Math.round(Math.min((studyTime / POMODORO_DURATION) * 100, 100))}% complete
                    </p>
                  </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    size="sm"
                    onClick={toggleStudying}
                    variant={studying ? 'default' : 'outline'}
                    className="flex-1 min-w-[80px]"
                  >
                    {studying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {studying ? 'Pause' : 'Start'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowFullscreen(true)}
                    className="flex-1 min-w-[80px]"
                  >
                    <Maximize className="h-4 w-4 mr-2" />
                    Focus
                  </Button>

                  <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenSettings}
                        className="flex-1 min-w-[80px]"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
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

                  {(studying || studyTime > 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={stopAndSave}
                      className="flex-1 min-w-[80px]"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H9a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop
                    </Button>
                  )}

                  {studyTime > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearTimer}
                      className="flex-1 min-w-[80px]"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>

              <FullscreenTimer
                isOpen={showFullscreen}
                onClose={() => setShowFullscreen(false)}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
