// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch, API_URL } from '@/config/api';
import { Switch } from '@/components/ui/switch';
import { soundManager } from '@/lib/sounds';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAvatarUrl } from '@/lib/avatar';
import { Camera, Upload, RefreshCw, X } from 'lucide-react';

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
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  // ── Avatar upload state ──────────────────────────────────────────────────
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const res = await apiFetch('/users/profile', {
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

  const handleStartVerification = async () => {
    setIsVerifying(true);
    try {
      const res = await apiFetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });

      if (res.ok) {
        setShowVerifyDialog(true);
        toast({ title: 'Verification Sent', description: 'Check your email for the OTP.' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsVerifying(true);
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, otp }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user); // Update user with verified status
        setShowVerifyDialog(false);
        setOtp('');
        toast({ title: 'Success', description: 'Email verified successfully!' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Invalid OTP');
      }
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Avatar upload handlers ───────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5 MB allowed.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      const res = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
      const data = await res.json();
      setUser((prev: any) => ({ ...prev, avatar: data.avatar, avatarType: 'upload' }));
      setShowAvatarDialog(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast({ title: 'Avatar updated!', description: 'Your profile photo has been saved.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUseGooglePhoto = async () => {
    const googlePhoto = (user as any)?.googlePhoto || (user as any)?.photos?.[0]?.value;
    if (!googlePhoto) {
      toast({ title: 'No Google photo', description: 'No Google profile photo found.', variant: 'destructive' });
      return;
    }
    setAvatarUploading(true);
    try {
      const res = await apiFetch('/users/avatar-url', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: googlePhoto, avatarType: 'google' }),
      });
      if (!res.ok) throw new Error('Failed to save Google photo');
      const updated = await res.json();
      setUser(updated);
      setShowAvatarDialog(false);
      toast({ title: 'Google photo applied!' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleResetAvatar = async () => {
    setAvatarUploading(true);
    try {
      const res = await apiFetch('/upload/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
      setUser((prev: any) => ({ ...prev, avatar: null, avatarType: 'generated' }));
      setShowAvatarDialog(false);
      toast({ title: 'Avatar reset to default.' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
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
            {/* Clickable avatar with camera overlay */}
            <button
              type="button"
              className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setShowAvatarDialog(true)}
              title="Change profile photo"
            >
              <img
                src={getAvatarUrl(user)}
                alt={user?.name}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-border group-hover:ring-primary transition-all"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </span>
            </button>
            <div>
              <p className="font-medium text-lg">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {!(user as any)?.emailVerified && (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={handleStartVerification}
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Sending...' : 'Verify Email'}
                </Button>
              )}
              {(user as any)?.username && (
                <p className="text-sm text-muted-foreground">@{(user as any).username}</p>
              )}
              <button
                type="button"
                onClick={() => setShowAvatarDialog(true)}
                className="text-xs text-primary hover:underline mt-1"
              >
                Change photo
              </button>
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

      {/* Avatar Upload Dialog — full editing freedom */}
      <Dialog open={showAvatarDialog} onOpenChange={(o) => { setShowAvatarDialog(o); if (!o) { setSelectedFile(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile Photo</DialogTitle>
            <DialogDescription>You can change your photo anytime.</DialogDescription>
          </DialogHeader>

          {/* Always-visible current → new avatar comparison */}
          <div className="flex items-center justify-center gap-6 py-2">
            {/* Current */}
            <div className="flex flex-col items-center gap-1">
              <img
                src={getAvatarUrl(user)}
                alt="Current"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
              />
              <span className="text-[10px] text-muted-foreground">Current</span>
            </div>

            {previewUrl && (
              <>
                <span className="text-muted-foreground text-lg">→</span>
                {/* New preview */}
                <div className="flex flex-col items-center gap-1 relative">
                  <img
                    src={previewUrl}
                    alt="New"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-primary"
                  />
                  <span className="text-[10px] text-primary font-medium">New</span>
                  <button
                    type="button"
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 shadow"
                    title="Remove selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Upload zone — always visible so they can always pick/change a file */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFileSelect(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl py-5 cursor-pointer text-center transition-all ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/60 hover:bg-muted/30'
              }`}
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-sm font-medium">
              {selectedFile ? 'Click to choose a different photo' : 'Click or drag & drop a photo'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, WebP · Max 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </div>

          {/* Action buttons — all always shown */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleUploadAvatar}
              disabled={!selectedFile || avatarUploading}
              className="w-full"
            >
              {avatarUploading ? 'Uploading…' : selectedFile ? '✓ Save New Photo' : 'Select a photo above to upload'}
            </Button>

            {(user as any)?.googleId && (
              <Button variant="outline" onClick={handleUseGooglePhoto} disabled={avatarUploading} className="w-full gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Use Google Photo
              </Button>
            )}

            <Button variant="ghost" onClick={handleResetAvatar} disabled={avatarUploading} className="w-full gap-2 text-muted-foreground text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Reset to generated avatar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verify Email Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Verification Code</DialogTitle>
            <DialogDescription>
              We sent a 6-digit code to {user?.email}. Please enter it below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>Cancel</Button>
            <Button onClick={handleVerifyOtp} disabled={isVerifying || otp.length < 6}>
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
