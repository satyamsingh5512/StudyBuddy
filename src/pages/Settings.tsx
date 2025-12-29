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
import { Settings as SettingsIcon, Target, Volume2, Shield, User, Sparkles, Trophy, Flame, Bell, Clock, Zap } from 'lucide-react';

export default function Settings() {
  const [user, setUser] = useAtom(userAtom);
  const [examGoal, setExamGoal] = useState(user?.examGoal || '');
  const [examDate, setExamDate] = useState(user?.examDate ? new Date(user.examDate).toISOString().split('T')[0] : '');
  const [showProfile, setShowProfile] = useState((user as any)?.showProfile !== false);
  const [soundsEnabled, setSoundsEnabled] = useState(soundManager.isEnabled());
  const [uiSounds, setUiSounds] = useState(soundManager.isEnabled('ui'));
  const [notificationSounds, setNotificationSounds] = useState(soundManager.isEnabled('notifications'));
  const [timerSounds, setTimerSounds] = useState(soundManager.isEnabled('timer'));
  const [authSounds, setAuthSounds] = useState(soundManager.isEnabled('auth'));
  const { toast } = useToast();

  useEffect(() => { soundManager.setEnabled(soundsEnabled); }, [soundsEnabled]);
  useEffect(() => { soundManager.setEnabled(uiSounds, 'ui'); }, [uiSounds]);
  useEffect(() => { soundManager.setEnabled(notificationSounds, 'notifications'); }, [notificationSounds]);
  useEffect(() => { soundManager.setEnabled(timerSounds, 'timer'); }, [timerSounds]);
  useEffect(() => { soundManager.setEnabled(authSounds, 'auth'); }, [authSounds]);

  const saveSettings = async () => {
    const res = await apiFetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examGoal, examDate: new Date(examDate), showProfile }),
    });
    if (res.ok) {
      setUser(await res.json());
      toast({ title: '✨ Settings saved!' });
    }
  };

  const SoundToggle = ({ id, label, description, checked, onChange, icon: Icon, disabled = false }: any) => (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
          <Icon className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(c) => { onChange(c); if (c) soundManager.playClick(); }} disabled={disabled} />
    </div>
  );

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 shadow-lg">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">Customize your experience</p>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-scale-in">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-violet-500" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
              <img src={user?.avatar || 'https://via.placeholder.com/96'} alt={user?.name}
                className="relative h-24 w-24 rounded-full ring-4 ring-violet-500/30" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">{user?.name}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              {(user as any)?.username && (
                <p className="text-sm text-violet-500 font-medium mt-1">@{(user as any).username}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center">
              <Trophy className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user?.totalPoints}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 text-center">
              <Flame className="h-6 w-6 text-rose-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user?.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-center">
              <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{Math.floor(((user as any)?.totalStudyMinutes || 0) / 60)}h</p>
              <p className="text-xs text-muted-foreground">Study Time</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 text-center">
              <Sparkles className="h-6 w-6 text-violet-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user?.examGoal}</p>
              <p className="text-xs text-muted-foreground">Goal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam Configuration */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-slide-up animation-delay-100">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-500" />
            Exam Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="examGoal" className="text-sm font-medium">Exam Goal</Label>
              <Input id="examGoal" value={examGoal} onChange={(e) => setExamGoal(e.target.value)}
                placeholder="e.g., JEE, NEET, UPSC" className="mt-2 h-12 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="examDate" className="text-sm font-medium">Exam Date</Label>
              <Input id="examDate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                className="mt-2 h-12 rounded-xl" />
            </div>
          </div>
          <Button onClick={saveSettings} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25">
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-slide-up animation-delay-200">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-indigo-500/5">
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-blue-500" />
            Sound Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <SoundToggle id="allSounds" label="All Sounds" description="Master control for all sound effects"
            checked={soundsEnabled} onChange={setSoundsEnabled} icon={Volume2} />
          <SoundToggle id="uiSounds" label="UI Sounds" description="Clicks, toggles, and button sounds"
            checked={uiSounds} onChange={setUiSounds} icon={Zap} disabled={!soundsEnabled} />
          <SoundToggle id="notificationSounds" label="Notifications" description="Chat messages and alerts"
            checked={notificationSounds} onChange={setNotificationSounds} icon={Bell} disabled={!soundsEnabled} />
          <SoundToggle id="timerSounds" label="Timer Sounds" description="Pomodoro completion alerts"
            checked={timerSounds} onChange={setTimerSounds} icon={Clock} disabled={!soundsEnabled} />
          <SoundToggle id="authSounds" label="Login Sounds" description="Sign in and authentication sounds"
            checked={authSounds} onChange={setAuthSounds} icon={User} disabled={!soundsEnabled} />
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-slide-up animation-delay-300">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-rose-500/5 to-pink-500/5">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-rose-500" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
                <User className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <Label htmlFor="showProfile" className="font-medium cursor-pointer">Show Profile in Chat</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow others to view your profile details</p>
              </div>
            </div>
            <Switch id="showProfile" checked={showProfile} onCheckedChange={setShowProfile} />
          </div>
          <Button onClick={saveSettings} className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-lg shadow-rose-500/25">
            Save Privacy Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
