import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { soundManager } from '../lib/sounds';
import { useToast } from '@/components/ui/use-toast';
import { API_URL } from '@/config/api';
import Logo from '@/components/Logo';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import ThemeToggle from '@/components/ThemeToggle';

export default function Auth() {
    const [authType, setAuthType] = useState<'signin' | 'signup'>('signin');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        soundManager.initialize();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        soundManager.playButtonPress();
        setIsLoading(true);

        try {
            if (authType === 'signup') {
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                const res = await fetch(`${API_URL}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email,
                        password,
                        name: `${firstName} ${lastName}`.trim(),
                        phone
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Signup failed');
                soundManager.playLogin();
                toast({ title: 'Success!', description: 'Account created. Check email for verification.' });
            } else {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');
                soundManager.playLogin();
                window.location.href = '/';
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        soundManager.playClick();
        window.location.href = `${API_URL}/auth/google`;
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
                                {authType === 'signin' ? 'Welcome Back!' : 'Create Account'}
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
                                    {/* Sign Up Fields */}
                                    {authType === 'signup' && (
                                        <>
                                            {/* Name Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                        <User size={16} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="First Name"
                                                        value={firstName}
                                                        onChange={(e) => setFirstName(e.target.value)}
                                                        className="w-full h-11 rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                        required
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Last Name"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    className="w-full h-11 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                    required
                                                />
                                            </div>

                                            {/* Phone */}
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                    <Phone size={16} />
                                                </div>
                                                <input
                                                    type="tel"
                                                    placeholder="Phone Number"
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    className="w-full h-11 rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Email */}
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
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Password"
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

                                    {/* Confirm Password - Only for Signup */}
                                    {authType === 'signup' && (
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Confirm Password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full h-11 rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all bg-input text-foreground font-montserrat"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Remember Me / Terms */}
                                    <div className="flex items-center justify-between text-xs py-1">
                                        {authType === 'signin' ? (
                                            <>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRememberMe(!rememberMe)}
                                                        className={`w-8 h-4 rounded-full transition-all relative ${rememberMe ? 'bg-primary' : 'bg-muted'}`}
                                                    >
                                                        <motion.div
                                                            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                                                            animate={{ left: rememberMe ? '16px' : '2px' }}
                                                            transition={{ duration: 0.2 }}
                                                        />
                                                    </button>
                                                    <span className="text-muted-foreground">Remember me</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    className="hover:underline text-primary"
                                                >
                                                    Forgot Password?
                                                </button>
                                            </>
                                        ) : (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={agreeTerms}
                                                    onChange={(e) => setAgreeTerms(e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-muted-foreground">
                                                    I agree to <span className="text-primary">Terms & Conditions</span>
                                                </span>
                                            </label>
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || (authType === 'signup' && !agreeTerms)}
                                        className="w-full h-12 font-semibold rounded-xl transition-all duration-300 text-primary-foreground disabled:opacity-50 bg-primary hover:bg-primary/90 shadow-lg"
                                    >
                                        {isLoading ? 'Please wait...' : (authType === 'signin' ? 'Sign In' : 'Create Account')}
                                    </button>
                                </motion.form>
                            </AnimatePresence>

                            {/* Divider */}
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">or continue with</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {/* Google Login */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="w-full h-11 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] bg-white/5 border border-border text-foreground font-montserrat"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span className="font-medium text-sm">Continue with Google</span>
                            </button>

                            {/* Switch Auth Type */}
                            <p className="mt-5 text-center text-sm text-muted-foreground">
                                {authType === 'signin' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    onClick={handleAuthTypeSwitch}
                                    className="font-semibold hover:underline text-primary"
                                >
                                    {authType === 'signin' ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </UnifiedPageWrapper>
    );
}
