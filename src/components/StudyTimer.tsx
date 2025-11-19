import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { studyingAtom, studyTimeAtom, userAtom } from '@/store/atoms';
import { Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatTime } from '@/lib/utils';
import { apiFetch } from '@/config/api';
import { useToast } from './ui/use-toast';

const POMODORO_DURATION = 50 * 60; // 50 minutes

export default function StudyTimer() {
  const [studying, setStudying] = useAtom(studyingAtom);
  const [studyTime, setStudyTime] = useAtom(studyTimeAtom);
  const [, setUser] = useAtom(userAtom);
  const { toast } = useToast();

  useEffect(() => {
    if (!studying) return;

    const interval = setInterval(() => {
      setStudyTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [studying, setStudyTime]);

  const saveSession = async (minutes: number) => {
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
  };

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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium">Study Timer</h3>
            <p className="text-xs text-muted-foreground">Pomodoro: 50 min focus</p>
          </div>
          <Button
            size="icon"
            onClick={toggleStudying}
            variant={studying ? 'default' : 'outline'}
            className={studying ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {studying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
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
