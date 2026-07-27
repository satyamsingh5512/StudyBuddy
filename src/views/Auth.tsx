import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Mail, ArrowLeft, Sparkles, CalendarClock, Clock3 } from 'lucide-react';
import { soundManager } from '../lib/sounds';
import { useToast } from '@/components/ui/use-toast';
import { SuccessConfetti } from '@/components/SuccessConfetti';
import Logo from '@/components/Logo';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import ThemeToggle from '@/components/ThemeToggle';
import { API_URL } from '../config/api';

export default function Auth() {
    const [authType, setAuthType] = useState<'signin' | 'signup' | 'verify-signup' | 'forgot-password' | 'verify-reset'>('signin');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        soundManager.initialize();

        // Handle OAuth success redirect hash (e.g., #google_token=...)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const googleToken = hashParams.get('google_token');
        if (googleToken) {
            localStorage.setItem('auth_token', googleToken);
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            toast({ title: 'Welcome!', description: 'Google sign-in successful.' });
            setShowSuccess(true);
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2500);
            return;
        }

        // Handle OAuth error redirects (e.g., ?error=google_failed)
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error');
        if (oauthError) {
            const messages: Record<string, string> = {
                google_denied: 'Google sign-in was cancelled.',
                google_failed: 'Google sign-in failed. Please try again.',
                google_not_configured: 'Google sign-in is not configured yet.',
                google_invalid_state: 'Google sign-in session expired. Please try again.',
                google_unverified_email: 'Google account email is not verified.',
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
                        name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
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
                setShowSuccess(true);
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2500);

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
                setShowSuccess(true);
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2500);

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

    // Shared field styling keeps every control on the same translucent surface
    // instead of the previous hard-filled boxes.
    const fieldClass = "w-full h-12 rounded-2xl border border-border/60 bg-foreground/[0.035] text-foreground placeholder:text-muted-foreground/70 outline-none transition-all duration-200 focus:border-primary/45 focus:bg-foreground/[0.055] focus:ring-4 focus:ring-primary/15 dark:bg-white/[0.04] dark:focus:bg-white/[0.07]";

    return (
        <UnifiedPageWrapper>
            <AnimatePresence>
                {showSuccess && <SuccessConfetti />}
            </AnimatePresence>

            <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
                {/* Soft tonal glow so the card sits in the page instead of on top of it */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />
                </div>

                {/* Theme Toggle */}
                <div className="absolute right-3 top-3 z-50 sm:right-6 sm:top-6">
                    <ThemeToggle />
                </div>

                {/* Back to home (mobile, where the visual panel is hidden) */}
                <button
                    type="button"
                    onClick={() => (window.location.href = '/')}
                    aria-label="Back to home"
                    className="absolute left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-foreground/[0.04] text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6 md:hidden dark:bg-white/[0.06]"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-strong relative z-10 w-full max-w-5xl overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] md:grid md:min-h-[620px] md:grid-cols-[0.92fr_1.08fr]"
                >
                    {/* Left Panel — same colour family as the app, no grey block */}
                    <div className="relative hidden overflow-hidden md:block md:border-r md:border-white/10">
                        <img
                            src="https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80"
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover opacity-30 dark:opacity-20"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/55 to-[#2563EB]/70" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10" />

                        <div className="absolute left-6 top-6 z-10">
                            <button
                                type="button"
                                onClick={() => (window.location.href = '/')}
                                aria-label="Back to home"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="absolute bottom-10 left-10 right-10 z-10 text-white">
                            <h2 className="font-heading text-3xl font-semibold tracking-tight">Study Smarter</h2>
                            <p className="mt-2 text-sm leading-relaxed text-white/80">
                                Join a community of students hitting their goals with AI-guided plans, focused sessions, and honest progress.
                            </p>
                            <ul className="mt-7 space-y-3 text-sm text-white/85">
                                {[
                                    { icon: CalendarClock, text: 'Plans built around your real availability' },
                                    { icon: Clock3, text: 'Focused timed sessions with full history' },
                                    { icon: Sparkles, text: 'AI suggestions tuned to your exam' },
                                ].map((item) => (
                                    <li key={item.text} className="flex items-center gap-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                                            <item.icon size={15} aria-hidden="true" />
                                        </span>
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right Panel — inherits the card surface, so there is no colour seam */}
                    <div className="flex flex-col justify-center p-6 pt-16 sm:p-10 sm:pt-16 md:p-12">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Logo className="w-10 h-10 text-foreground" highlighted animated />
                                <h1 className="text-lg font-semibold uppercase text-foreground" style={{ letterSpacing: '0.18em' }}>
                                    StudyBuddy
                                </h1>
                            </div>
                            
                            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground mb-2">
                                {authType === 'signin' && 'Welcome Back!'}
                                {authType === 'signup' && 'Create an Account'}
                                {(authType === 'verify-signup' || authType === 'verify-reset') && 'Verification'}
                                {authType === 'forgot-password' && 'Reset Password'}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                {authType === 'signin' && (
                                    <>Don't have an account? <button type="button" onClick={handleAuthTypeSwitch} className="text-primary hover:text-primary/80 font-medium transition-colors">Sign up</button></>
                                )}
                                {authType === 'signup' && (
                                    <>Already have an account? <button type="button" onClick={handleAuthTypeSwitch} className="text-primary hover:text-primary/80 font-medium transition-colors">Log in</button></>
                                )}
                                {(authType === 'verify-signup' || authType === 'forgot-password' || authType === 'verify-reset') && (
                                    <button type="button" onClick={() => { setAuthType('signin'); soundManager.playClick(); }} className="text-primary hover:text-primary/80 font-medium transition-colors">Back to log in</button>
                                )}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.form
                                key={authType}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                onSubmit={handleSubmit}
                                className="space-y-4"
                            >
                                {/* Name Fields - Show only for signup */}
                                {authType === 'signup' && (
                                    <div className="grid gap-4 pb-1 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label htmlFor="firstName" className="block text-sm font-medium text-foreground">First Name</label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                placeholder="John"
                                                className={`${fieldClass} px-4 text-sm`}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="lastName" className="block text-sm font-medium text-foreground">Last Name</label>
                                            <input
                                                type="text"
                                                id="lastName"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                placeholder="Doe"
                                                className={`${fieldClass} px-4 text-sm`}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Email Field */}
                                {(authType === 'signin' || authType === 'signup' || authType === 'forgot-password' || authType === 'verify-reset') && (
                                    <div className="space-y-1.5">
                                        <label htmlFor="email" className="block text-sm font-medium text-foreground">Email Address</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><Mail size={16} /></div>
                                            <input
                                                type="email"
                                                id="email"
                                                placeholder="name@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={`${fieldClass} pl-11 pr-4 text-sm disabled:opacity-60`}
                                                required
                                                disabled={authType === 'verify-reset'}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* OTP Field */}
                                {(authType === 'verify-signup' || authType === 'verify-reset') && (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground pb-2">Enter the 6-digit code sent to <span className="font-semibold text-foreground">{email}</span></p>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                placeholder="000000"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                maxLength={6}
                                                className={`${fieldClass} h-16 text-center text-3xl font-semibold tracking-[0.4em]`}
                                                required
                                            />
                                        </div>
                                        <div className="text-center pt-2">
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={resendCooldown > 0 || isLoading}
                                                className={`text-sm font-medium transition-colors ${resendCooldown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:text-primary/80'}`}
                                            >
                                                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Password Field */}
                                {(authType === 'signin' || authType === 'signup' || authType === 'verify-reset') && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="password" className="block text-sm font-medium text-foreground">
                                                {authType === 'verify-reset' ? 'New Password' : 'Password'}
                                            </label>
                                            {authType === 'signin' && (
                                                <button type="button" onClick={() => { setAuthType('forgot-password'); soundManager.playClick(); }} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                                                    Forgot password?
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={16} /></div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="password"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={`${fieldClass} pl-11 pr-12 text-sm`}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/10"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Confirm Password Field */}
                                {(authType === 'signup' || authType === 'verify-reset') && (
                                    <div className="space-y-1.5">
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                                            {authType === 'verify-reset' ? 'Confirm New Password' : 'Confirm Password'}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={16} /></div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="confirmPassword"
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className={`${fieldClass} pl-11 pr-4 text-sm`}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Checkboxes */}
                                {authType === 'signin' && (
                                    <div className="flex items-center gap-2.5 pt-1 pb-2">
                                        <input
                                            type="checkbox"
                                            id="rememberMe"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="h-4 w-4 rounded-md border-border accent-primary focus:ring-2 focus:ring-primary/30"
                                        />
                                        <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</label>
                                    </div>
                                )}

                                {authType === 'signup' && (
                                    <div className="flex items-center gap-2.5 pt-1 pb-2">
                                        <input
                                            type="checkbox"
                                            id="agreeTerms"
                                            checked={agreeTerms}
                                            onChange={(e) => setAgreeTerms(e.target.checked)}
                                            className="h-4 w-4 rounded-md border-border accent-primary focus:ring-2 focus:ring-primary/30"
                                        />
                                        <label htmlFor="agreeTerms" className="text-sm text-muted-foreground cursor-pointer select-none">
                                            I agree to the <button type="button" className="text-foreground font-medium hover:underline">Terms & Conditions</button>
                                        </label>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading || (authType === 'signup' && !agreeTerms)}
                                    className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-[#2563EB] text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_-12px_hsl(var(--primary)/0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-[1.08] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                                >
                                    {isLoading ? 'Please wait...' :
                                        authType === 'signin' ? 'Sign In' :
                                        authType === 'signup' ? 'Create Account' :
                                        authType === 'forgot-password' ? 'Send Reset Code' :
                                        authType === 'verify-reset' ? 'Reset Password' :
                                        'Verify Email'
                                    }
                                </button>

                                {/* Prominent forgot-password entry for sign-in */}
                                {authType === 'signin' && (
                                    <div className="text-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setAuthType('forgot-password'); soundManager.playClick(); }}
                                            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                                        >
                                            Forgot your password?
                                        </button>
                                    </div>
                                )}

                                {/* Google OAuth */}
                                {(authType === 'signin' || authType === 'signup') && (
                                    <>
                                        <div className="relative flex items-center py-3">
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
                                            <span className="px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">or</span>
                                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { window.location.href = `${API_URL}/auth/google`; }}
                                            className="group flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border/60 bg-foreground/[0.035] text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
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
                    </div>
                </motion.div>
            </div>
        </UnifiedPageWrapper>
    );
}
