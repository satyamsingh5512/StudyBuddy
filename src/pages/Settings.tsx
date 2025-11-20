import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { Switch } from '@/components/ui/switch';
import { soundManager } from '@/lib/sounds';

export default function Settings() {
  const [user, setUser] = useAtom(userAtom);
  const [examGoal, setExamGoal] = useState(user?.examGoal || '');
  const [examDate, setExamDate] = useState(
    user?.examDate ? new Date(user.examDate).toISOString().split('T')[0] : ''
  );
  const [showProfile, setShowProfile] = useState((user as any)?.showProfile !== false);
  const [soundsEnabled, setSoundsEnabled] = useState(soundManager.isEnabled());
  const [uiSounds, setUiSounds] = useState(soundManager.isEnabled('ui'));
  const [notificationSounds, setNotificationSounds] = useState(soundManager.isEnabled('notifications'));
  const [timerSounds, setTimerSounds] = useState(soundManager.isEnabled('timer'));
  const [authSounds, setAuthSounds] = useState(soundManager.isEnabled('auth'));
  const { toast } = useToast();

  useEffect(() => {
    soundManager.setEnabled(soundsEnabled);
  }, [soundsEnabled]);

  useEffect(() => {
    soundManager.setEnabled(uiSounds, 'ui');
  }, [uiSounds]);

  useEffect(() => {
    soundManager.setEnabled(notificationSounds, 'notifications');
  }, [notificationSounds]);

  useEffect(() => {
    soundManager.setEnabled(timerSounds, 'timer');
  }, [timerSounds]);

  useEffect(() => {
    soundManager.setEnabled(authSounds, 'auth');
  }, [authSounds]);

  const saveSettings = async () => {
    const res = await apiFetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examGoal,
        examDate: new Date(examDate),
        showProfile,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      toast({ title: 'Settings saved successfully' });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Exam Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="examGoal">Exam Goal</Label>
            <Input
              id="examGoal"
              value={examGoal}
              onChange={(e) => setExamGoal(e.target.value)}
              placeholder="e.g., JEE, NEET, UPSC"
            />
          </div>
          <div>
            <Label htmlFor="examDate">Exam Date</Label>
            <Input
              id="examDate"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <Button onClick={saveSettings}>Save Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sound Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allSounds">All Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Master control for all sound effects
              </p>
            </div>
            <Switch
              id="allSounds"
              checked={soundsEnabled}
              onCheckedChange={(checked) => {
                setSoundsEnabled(checked);
                if (checked) soundManager.playClick();
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="uiSounds">UI Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Clicks, toggles, and button sounds
              </p>
            </div>
            <Switch
              id="uiSounds"
              checked={uiSounds}
              onCheckedChange={(checked) => {
                setUiSounds(checked);
                if (checked) soundManager.playClick();
              }}
              disabled={!soundsEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notificationSounds">Notification Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Chat messages and alerts
              </p>
            </div>
            <Switch
              id="notificationSounds"
              checked={notificationSounds}
              onCheckedChange={(checked) => {
                setNotificationSounds(checked);
                if (checked) soundManager.playMessageNotification();
              }}
              disabled={!soundsEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="timerSounds">Timer Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Pomodoro completion alerts
              </p>
            </div>
            <Switch
              id="timerSounds"
              checked={timerSounds}
              onCheckedChange={(checked) => {
                setTimerSounds(checked);
                if (checked) soundManager.playTimerComplete();
              }}
              disabled={!soundsEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="authSounds">Login Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Sign in and authentication sounds
              </p>
            </div>
            <Switch
              id="authSounds"
              checked={authSounds}
              onCheckedChange={(checked) => {
                setAuthSounds(checked);
                if (checked) soundManager.playLogin();
              }}
              disabled={!soundsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showProfile">Show Profile in Chat</Label>
              <p className="text-sm text-muted-foreground">
                Allow other users to view your profile details when they click your name in chat
              </p>
            </div>
            <Switch
              id="showProfile"
              checked={showProfile}
              onCheckedChange={setShowProfile}
            />
          </div>
          <Button onClick={saveSettings}>Save Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={user?.avatar || 'https://via.placeholder.com/80'}
              alt={user?.name}
              className="h-20 w-20 rounded-full"
            />
            <div>
              <p className="font-medium text-lg">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {(user as any)?.username && (
                <p className="text-sm text-muted-foreground">@{(user as any).username}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Total Points</p>
              <p className="text-2xl font-bold">{user?.totalPoints}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-2xl font-bold">{user?.streak} days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
