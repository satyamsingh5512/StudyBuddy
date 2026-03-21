import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
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

    return (
        <UnifiedPageWrapper>
            <AnimatePresence>
                {showSuccess && <SuccessConfetti />}
            </AnimatePresence>
            
            <div className="min-h-screen flex items-center justify-center p-4 relative font-montserrat bg-gradient-to-br from-slate-900 via-blue-900/40 to-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                {/* Theme Toggle */}
                <div className="absolute top-6 right-6 z-50">
                    <ThemeToggle />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col md:flex-row w-full max-w-5xl bg-card rounded-3xl shadow-2xl overflow-hidden relative z-10 min-h-[600px]"
                >
                    {/* Left Panel */}
                    <div className="flex-1 relative overflow-hidden md:block hidden bg-slate-200 dark:bg-slate-800">
                        <div className="absolute top-6 left-6 z-10">
                            <button
                                type="button"
                                onClick={() => window.location.href = '/'}
                                className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/30 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        <div className="absolute inset-0">
                            <img
                                src="https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80"
                                alt="Study Buddy Setup"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <div className="absolute bottom-10 left-10 right-10 z-10 text-white">
                            <h2 className="text-3xl font-bold mb-2">Study Smarter</h2>
                            <p className="text-white/80">Join our community of students achieving their goals with AI-powered assistance.</p>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="flex-1 p-8 md:p-12 flex flex-col justify-center bg-background">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Logo className="w-10 h-10 text-foreground" highlighted animated />
                                <h1 className="text-xl font-bold tracking-wider uppercase text-foreground" style={{ letterSpacing: '0.15em' }}>
                                    StudyBuddy
                                </h1>
                            </div>
                            
                            <h2 className="text-3xl font-bold text-foreground mb-2">
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
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleSubmit}
                                className="space-y-4"
                            >
                                {/* Name Fields - Show only for signup */}
                                {authType === 'signup' && (
                                    <div className="grid grid-cols-2 gap-4 pb-1">
                                        <div className="space-y-1.5">
                                            <label htmlFor="firstName" className="block text-sm font-medium text-foreground">First Name</label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                placeholder="John"
                                                className="w-full h-11 px-4 rounded-xl border border-input bg-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-montserrat"
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
                                                className="w-full h-11 px-4 rounded-xl border border-input bg-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-montserrat"
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
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Mail size={16} /></div>
                                            <input
                                                type="email"
                                                id="email"
                                                placeholder="name@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-montserrat"
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
                                                placeholder="000 000"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                maxLength={6}
                                                className="w-full h-14 rounded-xl text-center text-3xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-input text-foreground font-montserrat"
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
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={16} /></div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="password"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full h-11 pl-10 pr-12 rounded-xl border border-input bg-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-montserrat"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-muted-foreground"
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
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={16} /></div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="confirmPassword"
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-montserrat"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Checkboxes */}
                                {authType === 'signin' && (
                                    <div className="flex items-center gap-2 pt-1 pb-2">
                                        <input
                                            type="checkbox"
                                            id="rememberMe"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                                        />
                                        <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</label>
                                    </div>
                                )}

                                {authType === 'signup' && (
                                    <div className="flex items-center gap-2 pt-1 pb-2">
                                        <input
                                            type="checkbox"
                                            id="agreeTerms"
                                            checked={agreeTerms}
                                            onChange={(e) => setAgreeTerms(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
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
                                    className="w-full h-12 mt-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                >
                                    {isLoading ? 'Please wait...' :
                                        authType === 'signin' ? 'Sign In' :
                                        authType === 'signup' ? 'Create Account' :
                                        authType === 'forgot-password' ? 'Send Reset Code' :
                                        authType === 'verify-reset' ? 'Reset Password' :
                                        'Verify Email'
                                    }
                                </button>

                                {/* Google OAuth */}
                                {(authType === 'signin' || authType === 'signup') && (
                                    <>
                                        <div className="relative flex items-center py-2">
                                            <div className="flex-1 border-t border-border" />
                                            <span className="px-4 text-xs text-muted-foreground bg-background">or</span>
                                            <div className="flex-1 border-t border-border" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { window.location.href = `${API_URL}/auth/google`; }}
                                            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-input bg-background hover:bg-muted transition-all text-sm font-medium text-foreground shadow-sm group"
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
