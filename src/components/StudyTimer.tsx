import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom, userAtom } from '@/store/atoms';
import { Play, Pause, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
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

export default function StudyTimer() {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [, setUser] = useAtom(userAtom);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved) : 50;
  });
  const [showSettings, setShowSettings] = useState(false);
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
        setUser(data.user);
        toast({
          title: 'Session saved!',
          description: `+${Math.floor(minutes / 5)} points earned`,
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [setUser, toast]);

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
    if (studying) {
      // Stopping - save the session
      const minutes = Math.floor(studyTime / 60);
      if (minutes > 0) {
        saveSession(minutes);
      }
    }
    setStudying(!studying);
    if (!studying) {
      setStudyTime(0);
    }
  };

  const progress = Math.min((studyTime / POMODORO_DURATION) * 100, 100);

  const saveDuration = (minutes: number) => {
    setPomodoroDuration(minutes);
    localStorage.setItem('pomodoroDuration', minutes.toString());
    setShowSettings(false);
    toast({ title: 'Timer duration updated', description: `Pomodoro set to ${minutes} minutes` });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium">Study Timer</h3>
            <p className="text-xs text-muted-foreground">Pomodoro: {pomodoroDuration} min focus</p>
          </div>
          <div className="flex gap-2">
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
                    <Label htmlFor="duration">Pomodoro Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      max="120"
                      defaultValue={pomodoroDuration}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= 120) {
                          saveDuration(val);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set your preferred focus duration (1-120 minutes)
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="icon"
              onClick={toggleStudying}
              variant={studying ? 'default' : 'outline'}
              className={studying ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {studying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {studying && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono">{formatTime(studyTime)}</span>
              <span className="text-muted-foreground">{Math.floor(progress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!studying && (
          <p className="text-sm text-muted-foreground">Click play to start studying</p>
        )}
      </CardContent>
    </Card>
  );
}
