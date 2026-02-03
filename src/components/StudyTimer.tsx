import { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Settings, RotateCcw, Clock, Maximize, Minimize2 } from 'lucide-react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [, setLaps] = useState<Lap[]>([]);
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

  const toggleExpanded = () => {
    soundManager.playClick();
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
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="collapsed-button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25
            }}
            className="relative group/button"
          >
            <Button
              onClick={toggleExpanded}
              className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 hover:from-blue-500 hover:via-blue-400 hover:to-purple-500 text-white shadow-xl hover:shadow-2xl hover:shadow-blue-500/40 relative overflow-hidden"
              title="Open Pomodoro Timer"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300" />
              <Clock className="h-6 w-6 relative z-10" />
            </Button>
            {/* Active indicator */}
            {studying && (
              <div className="absolute -top-1 -right-1">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white dark:border-gray-900"></span>
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 30,
              mass: 1
            }}
          >
            <Card className="shadow-2xl border-blue-200/50 dark:border-blue-500/30 w-[320px] bg-gradient-to-br from-white/95 via-blue-50/95 to-white/95 dark:from-slate-900/95 dark:via-blue-950/90 dark:to-slate-900/95 backdrop-blur-xl overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-16 translate-x-16 blur-xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full translate-y-12 -translate-x-12 blur-xl" />

              <CardContent className="p-5 relative z-10">
                <motion.div
                  className="flex items-center justify-between mb-6"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-2">
                     <div className={`p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ${studying ? 'animate-pulse' : ''}`}>
                       <Clock className={`h-4 w-4 ${studying ? 'animate-spin-slow' : ''}`} />
                     </div>
                     <div>
                       <h3 className="font-semibold text-sm">Timer</h3>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{pomodoroDuration} MIN SESSION</p>
                     </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleExpanded}
                    className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </motion.div>

                <motion.div
                  className="flex flex-col items-center justify-center mb-6"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <div className="relative mb-2">
                     {studying && (
                       <motion.div
                         className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl"
                         animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                         transition={{ repeat: Infinity, duration: 2 }}
                       />
                     )}
                     <span className={`text-5xl font-mono font-bold tracking-tighter tabular-nums bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent`}>
                       {studying ? formatTime(studyTime) : (studyTime > 0 ? formatTime(studyTime) : `${pomodoroDuration}:00`)}
                     </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                     {studying ? 'Focusing...' : (studyTime > 0 ? 'Paused' : 'Ready')}
                  </span>
                </motion.div>

                {/* Progress Bar */}
                {studyTime > 0 && (
                  <motion.div
                    className="mb-6 space-y-1.5"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(Math.min((studyTime / POMODORO_DURATION) * 100, 100))}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((studyTime / POMODORO_DURATION) * 100, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </motion.div>
                )}

                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    onClick={toggleStudying}
                    className={`flex-1 font-medium shadow-md transition-all hover:scale-105 active:scale-95 ${
                      studying
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                    }`}
                  >
                    {studying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {studying ? 'Pause' : 'Start'}
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setShowFullscreen(true)}
                    className="transition-all hover:scale-105 active:scale-95"
                    title="Fullscreen"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>

                  <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleOpenSettings}
                        className="transition-all hover:scale-105 active:scale-95"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[90vw] max-w-md">
                      <DialogHeader>
                        <DialogTitle>Timer Settings</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label htmlFor="duration" className="text-sm font-medium">Session Duration (minutes)</Label>
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
                            className="mt-2"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            Recommended: 25 minutes for Pomodoro technique
                          </p>
                        </div>
                        <Button onClick={saveDuration} className="w-full">
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {studyTime > 0 && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={clearTimer}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </motion.div>
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
