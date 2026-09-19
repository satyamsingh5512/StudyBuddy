import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from '@/lib/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { soundManager } from '@/lib/sounds';
import { useToast } from '@/components/ui/use-toast';
import { apiFetchJSON } from '@/config/api';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        title: 'Email required',
        description: 'Enter your account email first.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    soundManager.playClick();
    try {
      await apiFetchJSON('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });
      setCodeSent(true);
      setResendCooldown(60);
      toast({
        title: 'Code sent',
        description: 'Check your email for the 6-digit reset code.',
      });
    } catch (error) {
      toast({
        title: 'Could not send code',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedOtp = otp.trim();

    if (trimmedOtp.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Enter the 6-digit code from your email.',
        variant: 'destructive',
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Enter the same password in both fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    soundManager.playClick();

    try {
      await apiFetchJSON('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: trimmedOtp, password }),
      });
      toast({
        title: 'Password reset',
        description: 'You can now sign in with your new password.',
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: 'Reset failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UnifiedPageWrapper>
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Reset your password</CardTitle>
            <CardDescription>
              Enter your account email and the 6-digit code we sent you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email address</Label>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-code">Reset code</Label>
                <Input
                  id="reset-code"
                  name="one-time-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={isLoading}
                  aria-describedby="reset-code-help"
                />
                <p id="reset-code-help" className="text-xs text-muted-foreground">
                  The code expires after 10 minutes.
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={handleSendCode}
                  disabled={isSending || resendCooldown > 0}
                >
                  {isSending
                    ? 'Sending…'
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : codeSent
                        ? "Didn't receive the code? Resend"
                        : 'Send reset code'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading}
                    className="pr-12"
                    aria-describedby="new-password-help"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p id="new-password-help" className="text-xs text-muted-foreground">
                  Use at least 8 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  name="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Resetting password…' : 'Reset password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/auth')}
                disabled={isLoading}
              >
                Back to sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </UnifiedPageWrapper>
  );
}
