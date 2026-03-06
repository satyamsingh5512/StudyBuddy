import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { soundManager } from '../lib/sounds';
import { useToast } from '@/components/ui/use-toast';
import Logo from '@/components/Logo';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import ThemeToggle from '@/components/ThemeToggle';
import { API_URL } from '../config/api';

export default function Auth() {
    const [authType, setAuthType] = useState<'signin' | 'signup' | 'verify-signup' | 'forgot-password' | 'verify-reset'>('signin');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const { toast } = useToast();

    useEffect(() => {
        soundManager.initialize();

        // Handle OAuth error redirects (e.g., ?error=google_failed)
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error');
        if (oauthError) {
            const messages: Record<string, string> = {
                google_denied: 'Google sign-in was cancelled.',
                google_failed: 'Google sign-in failed. Please try again.',
            };
            toast({
                title: 'Sign-in Error',
                description: messages[oauthError] || 'An error occurred during sign-in.',
                variant: 'destructive',
            });
            // Clean the URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [toast]);


    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendCooldown > 0) {
            timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;

        soundManager.playClick();
        setIsLoading(true); // Reusing isLoading to block other actions

        try {
            let endpoint = '';
            if (authType === 'verify-signup') {
                endpoint = '/auth/resend-otp';
            } else if (authType === 'verify-reset') {
                // For reset pass, we just hit forgot-password again to generate new code
                endpoint = '/auth/forgot-password';
            } else {
                return;
            }

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to resend code');

            console.log('📧 Resend OTP response:', data); // Debug log

            toast({
                title: 'Code Resent',
                description: 'Please check your email for the new code.',
                duration: 5000
            });

            setResendCooldown(60);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        soundManager.playButtonPress();
        setIsLoading(true);

        try {
            if (authType === 'signup') {
                // Validation
                if (password.length < 8) {
                    throw new Error('Password must be at least 8 characters long');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }

                const res = await fetch(`${API_URL}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: email.trim(),
                        password,
                        name: email.split('@')[0],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Signup failed');

                console.log('📧 Signup response:', data); // Debug log

                toast({
                    title: 'Account Created',
                    description: data.message || 'Please check your email for the verification code.',
                    duration: 5000
                });

                setAuthType('verify-signup');
                setResendCooldown(60);

            } else if (authType === 'verify-signup') {
                if (otp.length !== 6) {
                    throw new Error('Please enter a valid 6-digit code');
                }

                const res = await fetch(`${API_URL}/auth/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verification failed');

                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }

                soundManager.playLogin();
                toast({ title: 'Success!', description: data.message || 'Email verified. You are now logged in.' });
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);

            } else if (authType === 'signin') {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: email.trim(), password }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (data.code === 'EMAIL_NOT_VERIFIED') {
                        console.log('📧 Login response (unverified):', data); // Debug log
                        toast({
                            title: 'Email Not Verified',
                            description: 'A new verification code has been sent to your email.',
                            duration: 5000
                        });
                        setAuthType('verify-signup');
                        setResendCooldown(60);
                    }
                    throw new Error(data.error || 'Login failed');
                }

                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }

                soundManager.playLogin();
                toast({ title: 'Welcome back!', description: 'Login successful' });
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);

            } else if (authType === 'forgot-password') {
                const res = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: email.trim() }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Request failed');

                console.log('📧 Forgot password response:', data); // Debug log

                toast({
                    title: 'Code Sent',
                    description: data.message || 'Check your email for the password reset code.',
                    duration: 5000
                });

                setAuthType('verify-reset');
                setResendCooldown(60);

            } else if (authType === 'verify-reset') {
                if (otp.length !== 6) {
                    throw new Error('Please enter a valid 6-digit code');
                }
                if (password.length < 8) {
                    throw new Error('Password must be at least 8 characters long');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }

                const res = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Reset failed');

                toast({ title: 'Password Reset', description: data.message || 'Your password has been changed. Please sign in.' });
                setAuthType('signin');
                setPassword('');
                setConfirmPassword('');
                setOtp('');
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthTypeSwitch = () => {
        setAuthType(authType === 'signin' ? 'signup' : 'signin');
        soundManager.playClick();
    };

    // Stars and Theme elements moved to BackgroundElements.tsx and global styles

    return (
        <UnifiedPageWrapper>
            <div className="min-h-screen flex items-center justify-center p-4 relative font-montserrat">
                {/* Theme Toggle - Positioned absolutely as before */}
                <div className="absolute top-6 right-6 z-50">
                    <ThemeToggle />
                </div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div
                        className="rounded-3xl overflow-hidden glass-card"
                    >
                        {/* App Branding */}
                        <div className="pt-8 pb-4 px-8 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring' }}
                                className="flex flex-col items-center justify-center gap-3 mb-2"
                            >
                                <div className="flex items-center justify-center p-2">
                                    <Logo className="w-16 h-16 text-foreground" highlighted animated />
                                </div>
                                <h1
                                    className="text-2xl font-semibold tracking-wider uppercase text-foreground mt-2"
                                    style={{ letterSpacing: '0.2em' }}
                                >
                                    StudyBuddy
                                </h1>
                            </motion.div>
                            <p className="text-muted-foreground text-sm font-medium">
                                Your AI-powered study companion
                            </p>
                        </div>

                        {/* Card Body */}
                        <div className="px-8 pb-8">
                            <h2 className="text-xl font-semibold text-center mb-6 text-foreground">
                                {authType === 'signin' && 'Welcome Back!'}
                                {authType === 'signup' && 'Create Account'}
                                {(authType === 'verify-signup' || authType === 'verify-reset') && 'Verification'}
                                {authType === 'forgot-password' && 'Reset Password'}
                            </h2>

                            <AnimatePresence mode="wait">
                                <motion.form
                                    key={authType}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    onSubmit={handleSubmit}
                                    className="space-y-3"
                                >
                                    {/* Email Field - Show for signin, signup, forgot-password */}
                                    {(authType === 'signin' || authType === 'signup' || authType === 'forgot-password' || authType === 'verify-reset') && (
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Mail size={16} />
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="Email Address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full h-11 rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                required
                                                disabled={authType === 'verify-reset'} // Lock email during reset verification
                                            />
                                        </div>
                                    )}

                                    {/* OTP Field - Show for verify-signup, verify-reset */}
                                    {(authType === 'verify-signup' || authType === 'verify-reset') && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <p className="text-center text-sm text-muted-foreground mb-4">
                                                    Enter the 6-digit code sent to {email}
                                                </p>
                                                <input
                                                    type="text"
                                                    placeholder="000000"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    maxLength={6}
                                                    className="w-full h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                    required
                                                />
                                            </div>

                                            <div className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={handleResendOtp}
                                                    disabled={resendCooldown > 0 || isLoading}
                                                    className={`text-sm font-medium transition-colors ${resendCooldown > 0
                                                        ? 'text-muted-foreground cursor-not-allowed'
                                                        : 'text-primary hover:underline'
                                                        }`}
                                                >
                                                    {resendCooldown > 0
                                                        ? `Resend code in ${resendCooldown}s`
                                                        : "Didn't receive code? Resend"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Password Field - Show for signin, signup, verify-reset */}
                                    {(authType === 'signin' || authType === 'signup' || authType === 'verify-reset') && (
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={authType === 'verify-reset' ? "New Password" : "Password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full h-11 rounded-xl pl-10 pr-10 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity text-muted-foreground"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    )}

                                    {/* Confirm Password - Show for signup, verify-reset */}
                                    {(authType === 'signup' || authType === 'verify-reset') && (
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={authType === 'verify-reset' ? "Confirm New Password" : "Confirm Password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full h-11 rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Remember Me / Forgot Password - Show only for signin */}
                                    {authType === 'signin' && (
                                        <div className="flex items-center justify-between text-xs py-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                    aria-label="Remember me"
                                                />
                                                <span className="text-muted-foreground">Remember me</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setAuthType('forgot-password')}
                                                className="hover:underline text-primary"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    )}

                                    {/* Terms Checkbox - Show only for signup */}
                                    {authType === 'signup' && (
                                        <div className="flex items-center gap-2 cursor-pointer text-xs py-1">
                                            <input
                                                type="checkbox"
                                                checked={agreeTerms}
                                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className="text-muted-foreground">
                                                I agree to <span className="text-primary">Terms & Conditions</span>
                                            </span>
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || (authType === 'signup' && !agreeTerms)}
                                        className="w-full h-12 font-semibold rounded-xl transition-all duration-300 text-primary-foreground disabled:opacity-50 bg-primary hover:bg-primary/90 shadow-lg mt-2"
                                    >
                                        {isLoading ? 'Please wait...' :
                                            authType === 'signin' ? 'Sign In' :
                                                authType === 'signup' ? 'Create Account' :
                                                    authType === 'forgot-password' ? 'Send Reset Code' :
                                                        authType === 'verify-reset' ? 'Reset Password' :
                                                            'Verify Email'
                                        }
                                    </button>

                                    {/* Google OAuth Button - only on signin/signup */}
                                    {(authType === 'signin' || authType === 'signup') && (
                                        <>
                                            <div className="relative flex items-center my-1">
                                                <div className="flex-1 border-t border-border" />
                                                <span className="px-3 text-xs text-muted-foreground">or</span>
                                                <div className="flex-1 border-t border-border" />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { window.location.href = '/api/auth/google'; }}
                                                className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-muted transition-all duration-200 text-sm font-medium text-foreground shadow-sm"
                                            >
                                                {/* Google SVG Icon */}
                                                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                                    <g fill="none" fillRule="evenodd">
                                                        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                                                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                                                    </g>
                                                </svg>
                                                Continue with Google
                                            </button>
                                        </>
                                    )}
                                </motion.form>
                            </AnimatePresence>

                            {/* Switch Auth Type */}
                            <p className="mt-5 text-center text-sm text-muted-foreground">
                                {authType === 'signin' && "Don't have an account? "}
                                {authType === 'signup' && "Already have an account? "}
                                {(authType === 'verify-signup' || authType === 'forgot-password' || authType === 'verify-reset') && (
                                    <button
                                        type="button"
                                        onClick={() => setAuthType('signin')}
                                        className="font-semibold hover:underline text-primary"
                                    >
                                        Back to Sign In
                                    </button>
                                )}

                                {(authType === 'signin' || authType === 'signup') && (
                                    <button
                                        onClick={handleAuthTypeSwitch}
                                        className="font-semibold hover:underline text-primary"
                                    >
                                        {authType === 'signin' ? 'Sign Up' : 'Sign In'}
                                    </button>
                                )}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </UnifiedPageWrapper>
    );
}
