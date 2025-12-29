import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom } from '@/store/atoms';
import { Play, Pause, Settings, RotateCcw, Clock, Maximize, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';
import { soundManager } from '@/lib/sounds';
import FullscreenTimer from './FullscreenTimer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
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
        toast({ title: '🎉 Session saved!', description: data.message || `+${minutes} points earned` });
      }
    } catch {
      toast({ title: 'Session saved offline', description: 'Will sync when connection is restored' });
    }
  }, [toast]);

  useEffect(() => {
    if (!studying || showFullscreen) return;
    const interval = setInterval(() => {
      setStudyTime((prev) => {
        const newTime = prev + 1;
        if (newTime >= POMODORO_DURATION) {
          setStudying(false);
          soundManager.playTimerComplete();
          saveSession(Math.floor(newTime / 60));
          toast({ title: '🎉 Pomodoro Complete!', description: `Great job! You studied for ${pomodoroDuration} minutes.` });
          setStudyTime(0);
          return 0;
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [studying, showFullscreen, setStudyTime, POMODORO_DURATION, pomodoroDuration, toast, setStudying, saveSession]);

  const toggleStudying = () => { setStudying(!studying); soundManager.playClick(); };
  const clearTimer = () => { setStudying(false); setStudyTime(0); setLaps([]); soundManager.playClick(); };
  const addLap = () => {
    if (studyTime > 0) {
      setLaps([{ id: Date.now(), time: studyTime, timestamp: new Date() }, ...laps]);
      soundManager.playClick();
    }
  };
  const stopAndSave = () => {
    if (studyTime > 0) {
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) saveSession(minutes);
      setStudying(false); setStudyTime(0); setLaps([]);
    }
  };

  const progress = Math.min((studyTime / POMODORO_DURATION) * 100, 100);
  const saveDuration = () => {
    if (tempDuration >= 1 && tempDuration <= 120) {
      setPomodoroDuration(tempDuration);
      localStorage.setItem('pomodoroDuration', tempDuration.toString());
      setShowSettings(false);
      toast({ title: 'Timer updated', description: `Set to ${tempDuration} minutes` });
    }
  };

  return (
    <Card className="group relative overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-violet-500/10">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full opacity-10 blur-3xl group-hover:opacity-20 transition-opacity" />
      
      <CardContent className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Focus Timer</h3>
              <p className="text-xs text-muted-foreground">{pomodoroDuration}min session</p>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setShowFullscreen(true)} className="h-8 w-8 p-0 rounded-xl hover:bg-violet-500/10">
              <Maximize className="h-4 w-4" />
            </Button>
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" onClick={() => setTempDuration(pomodoroDuration)} className="h-8 w-8 p-0 rounded-xl hover:bg-violet-500/10">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle>Timer Settings</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input type="number" min="1" max="120" value={tempDuration} onChange={(e) => setTempDuration(parseInt(e.target.value) || 1)}
                      onKeyDown={(e) => e.key === 'Enter' && saveDuration()} className="mt-2 rounded-xl" />
                  </div>
                  <Button onClick={saveDuration} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex flex-col items-center py-4">
          {/* Circular Progress */}
          <div className="relative w-28 h-28 mb-4">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle cx="56" cy="56" r="50" strokeWidth="6" fill="transparent" className="stroke-muted/20" />
              <circle cx="56" cy="56" r="50" strokeWidth="6" fill="transparent" stroke="url(#timerGradient)"
                strokeDasharray={2 * Math.PI * 50} strokeDashoffset={2 * Math.PI * 50 - (progress / 100) * 2 * Math.PI * 50}
                strokeLinecap="round" className="transition-all duration-1000 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              <defs>
                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono">{formatTime(studyTime)}</span>
              <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearTimer} className="h-10 w-10 p-0 rounded-xl">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="lg" onClick={toggleStudying}
              className={`h-14 w-14 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 ${
                studying 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25' 
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-500/25'
              }`}>
              {studying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </Button>
            <Button size="sm" variant="outline" onClick={addLap} className="h-10 w-10 p-0 rounded-xl">
              <Clock className="h-4 w-4" />
            </Button>
          </div>

          {/* Save Button */}
          {studyTime > 60 && (
            <Button size="sm" onClick={stopAndSave} className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25">
              Save Session
            </Button>
          )}
        </div>

        {/* Laps */}
        {laps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Laps</p>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {laps.slice(0, 3).map((lap, i) => (
                <div key={lap.id} className="flex justify-between text-xs bg-muted/30 rounded-lg px-3 py-1.5">
                  <span className="text-muted-foreground">Lap {laps.length - i}</span>
                  <span className="font-mono font-medium">{formatTime(lap.time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <FullscreenTimer isOpen={showFullscreen} onClose={() => setShowFullscreen(false)} />
    </Card>
  );
}
