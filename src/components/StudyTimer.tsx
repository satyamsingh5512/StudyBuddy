import { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Settings, RotateCcw, Clock, Maximize } from 'lucide-react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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

  const toggleExpanded = () => {
    if (isExpanded) {
      // Start closing animation
      setIsClosing(true);
      // Wait for animation to complete before collapsing
      setTimeout(() => {
        setIsExpanded(false);
        setIsClosing(false);
      }, 500); // Match the animation duration
    } else {
      setIsExpanded(true);
    }
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
    <>
      {/* Compact Round Button */}
      {!isExpanded && (
        <div className="relative group/button">
          <Button
            onClick={toggleExpanded}
            className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 hover:from-blue-700 hover:via-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-2xl transition-all duration-700 hover:scale-125 hover:-rotate-180 hover:shadow-blue-500/50 relative overflow-hidden"
            title="Open Pomodoro Timer"
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500 animate-pulse"></div>
            <Clock className="h-5 w-5 transition-all duration-700 group-hover/button:scale-125 group-hover/button:rotate-12 relative z-10" />
          </Button>
          {/* Active indicator with advanced animation */}
          {studying && (
            <>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-bounce shadow-lg shadow-green-500/50 z-20"></div>
              {/* Pulsating ring effect */}
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500/30 rounded-full animate-ping"></div>
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-green-500/20 rounded-full animate-pulse"></div>
            </>
          )}
        </div>
      )}

      {/* Expanded Timer Card with Advanced Animations */}
      {isExpanded && (
        <Card className={`group relative overflow-hidden shadow-2xl border-2 border-blue-200/50 dark:border-blue-500/30 min-w-[280px] bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/20 dark:via-gray-900/50 dark:to-blue-950/10 w-full transition-all duration-700 ease-out ${
          isClosing 
            ? 'animate-out fade-out slide-out-to-bottom-8 scale-90 opacity-0 rotate-3' 
            : 'animate-in fade-in slide-in-from-bottom-8 scale-100 opacity-100 rotate-0'
        }`}>
          {/* Multiple decorative animated orbs */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/30 to-purple-600/20 rounded-full -translate-y-10 translate-x-10 group-hover:scale-150 transition-all duration-1000 ease-out blur-xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-green-400/20 to-blue-500/20 rounded-full translate-y-8 -translate-x-8 group-hover:scale-125 transition-all duration-700 ease-out blur-lg animate-pulse" style={{ animationDelay: '500ms' }}></div>
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-pink-500/10 rounded-full -translate-x-16 -translate-y-16 group-hover:rotate-180 transition-all duration-1000 ease-out blur-2xl"></div>
          
          <CardContent className="p-4 sm:p-6 relative backdrop-blur-sm">
            <div className="relative z-10">
              {/* Header with close button - Animated entrance */}
              <div className={`flex items-center justify-between mb-4 transition-all duration-300 ease-out ${
                isClosing 
                  ? 'animate-out slide-out-to-left duration-300' 
                  : 'animate-in slide-in-from-left duration-500 delay-100 ease-out'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-lg transition-all duration-500 ease-out hover:scale-110 hover:rotate-6 hover:shadow-lg hover:shadow-blue-500/25 ${
                    isClosing 
                      ? 'animate-out zoom-out rotate-180 duration-400' 
                      : 'animate-in zoom-in rotate-0 duration-600 delay-200 ease-out'
                  } ${studying ? 'animate-pulse' : ''}`}>
                    <Clock className={`h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 transition-all duration-700 ${studying ? 'animate-spin' : ''}`} style={studying ? { animationDuration: '3s' } : {}} />
                  </div>
                  <div className={`transition-all duration-300 ease-out ${
                    isClosing 
                      ? 'animate-out slide-out-to-right duration-300' 
                      : 'animate-in slide-in-from-right duration-500 delay-300 ease-out'
                  }`}>
                    <h3 className="font-medium text-sm sm:text-base">Pomodoro Timer</h3>
                    <p className="text-xs text-muted-foreground">
                      {pomodoroDuration}min focus sessions
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleExpanded}
                  className={`h-8 w-8 p-0 hover:bg-gradient-to-br hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 transition-all duration-500 hover:scale-125 hover:rotate-180 hover:shadow-lg hover:shadow-blue-500/20 ${
                    isClosing 
                      ? 'animate-out zoom-out rotate-180 duration-400 delay-100' 
                      : 'animate-in zoom-in rotate-0 duration-600 delay-400 ease-out'
                  }`}
                  title="Minimize Timer"
                >
                  <svg className="h-4 w-4 transition-transform duration-300 hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>

              {/* Timer Display with Advanced Animation */}
              <div className={`text-center mb-4 transition-all duration-500 ease-out ${
                isClosing 
                  ? 'animate-out slide-out-to-bottom duration-400 delay-200' 
                  : 'animate-in slide-in-from-bottom duration-700 delay-500 ease-out'
              }`}>
                <div className={`relative inline-block text-3xl sm:text-4xl font-mono font-bold mb-2 transition-all duration-500 ease-out group/timer ${
                  isClosing 
                    ? 'animate-out zoom-out rotate-12 duration-400 delay-300' 
                    : 'animate-in zoom-in rotate-0 duration-800 delay-600 ease-out'
                }`}>
                  {/* Glowing background for active timer */}
                  {studying && (
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-blue-500/20 to-purple-500/20 rounded-lg blur-xl animate-pulse -z-10 scale-150"></div>
                  )}
                  <span className={`bg-gradient-to-r from-blue-700 via-purple-600 to-blue-700 dark:from-blue-300 dark:via-purple-400 dark:to-blue-300 bg-clip-text text-transparent transition-all duration-700 hover:scale-110 inline-block ${
                    studying ? 'animate-pulse' : ''
                  }`} style={studying ? { animationDuration: '2s' } : {}}>
                    {studying ? formatTime(studyTime) : (studyTime > 0 ? formatTime(studyTime) : `${pomodoroDuration}:00`)}
                  </span>
                </div>
                <p className={`text-sm text-blue-600/80 dark:text-blue-400/80 font-medium transition-all duration-300 ease-out ${
                  isClosing 
                    ? 'animate-out fade-out duration-300 delay-400' 
                    : 'animate-in fade-in duration-500 delay-700 ease-out'
                }`}>
                  {studying ? 'Studying now' : (studyTime > 0 ? 'Paused' : 'Ready to start')}
                </p>
              </div>

              {/* Progress Bar with Advanced Animation */}
              {studyTime > 0 && (
                <div className={`mb-4 transition-all duration-500 ease-out ${
                  isClosing 
                    ? 'animate-out slide-out-to-left duration-400 delay-500' 
                    : 'animate-in slide-in-from-left duration-600 delay-800 ease-out'
                }`}>
                  <div className="relative w-full bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30 rounded-full h-3 overflow-hidden shadow-inner">
                    {/* Animated shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" style={{ animationDuration: '3s' }}></div>
                    <div
                      className={`relative bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-blue-500/50 ${
                        isClosing 
                          ? 'animate-out slide-out-to-left duration-400 delay-600' 
                          : 'animate-in slide-in-from-left duration-800 delay-900 ease-out'
                      } ${studying ? 'animate-pulse' : ''}`}
                      style={{ 
                        width: `${Math.min((studyTime / POMODORO_DURATION) * 100, 100)}%`,
                        animationDuration: studying ? '2s' : undefined
                      }}
                    >
                      {/* Progress bar glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/40 animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-xs text-center mt-1 text-muted-foreground animate-in fade-in duration-500 delay-1000 ease-out">
                    {Math.round(Math.min((studyTime / POMODORO_DURATION) * 100, 100))}% complete
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className={`flex flex-wrap gap-2 justify-center transition-all duration-500 ease-out ${
                isClosing 
                  ? 'animate-out slide-out-to-bottom duration-400 delay-700' 
                  : 'animate-in slide-in-from-bottom-4 duration-600 delay-200'
              }`}>
                <Button
                  size="sm"
                  onClick={toggleStudying}
                  variant={studying ? 'default' : 'outline'}
                  className={`flex-1 min-w-[80px] transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg group/btn relative overflow-hidden ${
                    isClosing 
                      ? 'animate-out slide-out-to-bottom rotate-6 duration-400 delay-800' 
                      : 'animate-in slide-in-from-bottom-4 rotate-0 duration-600 delay-300'
                  } ${studying ? 'bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30 animate-pulse' : 'hover:border-blue-500 hover:shadow-blue-500/30'}`}
                  style={studying ? { animationDuration: '2s' } : {}}
                >
                  {studying && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/btn:animate-pulse"></div>}
                  {studying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {studying ? 'Pause' : 'Start'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFullscreen(true)}
                  className={`flex-1 min-w-[80px] transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg hover:border-purple-500 hover:shadow-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/20 ${
                    isClosing 
                      ? 'animate-out slide-out-to-bottom rotate-6 duration-400 delay-900' 
                      : 'animate-in slide-in-from-bottom-4 rotate-0 duration-600 delay-400'
                  }`}
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
                      className={`flex-1 min-w-[80px] transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg hover:border-blue-500 hover:shadow-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:rotate-3 ${
                        isClosing 
                          ? 'animate-out slide-out-to-bottom rotate-6 duration-400 delay-1000' 
                          : 'animate-in slide-in-from-bottom-4 rotate-0 duration-600 delay-500'
                      }`}
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

                {studyTime > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearTimer}
                    className={`flex-1 min-w-[80px] transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg hover:border-red-500 hover:shadow-red-500/30 hover:bg-red-50 dark:hover:bg-red-950/20 hover:-rotate-3 ${
                      isClosing 
                        ? 'animate-out slide-out-to-bottom rotate-6 duration-400 delay-1100' 
                        : 'animate-in slide-in-from-bottom-4 rotate-0 duration-600 delay-600'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>

          <FullscreenTimer
            isOpen={showFullscreen}
            onClose={() => setShowFullscreen(false)}
          />
        </Card>
      )}
    </>
  );
}
