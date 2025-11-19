import { useState } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { Switch } from '@/components/ui/switch';

export default function Settings() {
  const [user, setUser] = useAtom(userAtom);
  const [examGoal, setExamGoal] = useState(user?.examGoal || '');
  const [examDate, setExamDate] = useState(
    user?.examDate ? new Date(user.examDate).toISOString().split('T')[0] : ''
  );
  const [showProfile, setShowProfile] = useState((user as any)?.showProfile !== false);
  const { toast } = useToast();

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
