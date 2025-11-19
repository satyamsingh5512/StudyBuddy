import { useState } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { User, Sparkles } from 'lucide-react';

const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Adventurer', preview: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { id: 'avataaars', name: 'Avataaars', preview: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
  { id: 'bottts', name: 'Bottts', preview: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix' },
  { id: 'lorelei', name: 'Lorelei', preview: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Felix' },
  { id: 'micah', name: 'Micah', preview: 'https://api.dicebear.com/7.x/micah/svg?seed=Felix' },
  { id: 'pixel-art', name: 'Pixel Art', preview: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Felix' },
];

export default function Onboarding() {
  const [user, setUser] = useAtom(userAtom);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [avatarType, setAvatarType] = useState<'photo' | 'animated'>('photo');
  const [selectedStyle, setSelectedStyle] = useState('adventurer');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast({ title: 'Username required', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const avatarUrl =
        avatarType === 'animated'
          ? `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${username}`
          : user?.avatar;

      const res = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          avatarType,
          avatar: avatarUrl,
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        toast({ title: 'Welcome to StudyBuddy!' });
      } else {
        const error = await res.json();
        toast({ title: error.error || 'Username already taken', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to StudyBuddy!</CardTitle>
          <CardDescription>Let's set up your profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Choose a username</Label>
                <Input
                  id="username"
                  placeholder="e.g., study_master_2024"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={() => setStep(2)} disabled={!username.trim()} className="flex-1">
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Choose your avatar style</Label>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => setAvatarType('photo')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      avatarType === 'photo'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">Profile Photo</p>
                        <p className="text-xs text-muted-foreground">Use your Google photo</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setAvatarType('animated')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      avatarType === 'animated'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">Animated Avatar</p>
                        <p className="text-xs text-muted-foreground">Choose a fun style</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {avatarType === 'animated' && (
                <div>
                  <Label>Select avatar style</Label>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {AVATAR_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedStyle === style.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/${style.id}/svg?seed=${username || 'preview'}`}
                          alt={style.name}
                          className="w-full aspect-square rounded-lg mb-2"
                        />
                        <p className="text-xs font-medium text-center">{style.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
