import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Users, TrendingUp, Calendar, Target, Smartphone, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import { userAtom } from '@/store/atoms';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import { apiFetch } from '@/config/api';

const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export default function Landing() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const user = useAtomValue(userAtom);

    // Waitlist state
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [waitlistMessage, setWaitlistMessage] = useState('');

    const handleGetStarted = () => {
        if (isLoading) return;
        if (user) {
            navigate('/dashboard');
            return;
        }
        setIsLoading(true);
        navigate('/auth');
    };

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!waitlistEmail.trim() || waitlistStatus === 'loading') return;

        setWaitlistStatus('loading');
        try {
            const res = await apiFetch('/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: waitlistEmail.trim() }),
            });
            const data = await res.json();

            if (res.ok) {
                setWaitlistStatus('success');
                setWaitlistMessage(data.message || 'You\'re on the waitlist!');
                setWaitlistEmail('');
            } else {
                setWaitlistStatus('error');
                setWaitlistMessage(data.error || 'Something went wrong. Please try again.');
            }
        } catch {
            setWaitlistStatus('error');
            setWaitlistMessage('Failed to connect. Please try again later.');
        }
    };

    return (
        <UnifiedPageWrapper>
            {/* Header */}
            <header className="relative z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between max-w-7xl">
                    <Link
                        to="/"
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                        <Logo className="w-6 h-6 text-foreground" highlighted noLink />
                        <span className="font-semibold text-lg tracking-wider uppercase" style={{ letterSpacing: '0.2em' }}>
                            StudyBuddy
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8">
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm text-foreground font-medium transition-colors"
                        >
                            Home
                        </button>
                        <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Support
                        </Link>
                        <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            About Us
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <Button
                            onClick={handleGetStarted}
                            className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-6"
                            disabled={isLoading}
                        >
                            {user ? 'Dashboard' : 'Sign In'}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Content */}
            <main className="relative z-10 pt-16 pb-32">
                <div className="container mx-auto px-6 max-w-7xl">
                    {/* Hero Text */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-4xl mx-auto mb-12"
                    >
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                            <span className="italic">Study Smarter</span>
                            <span className="relative inline-block mx-2">
                                ,
                                {/* Decorative squiggle under the comma */}
                                <svg className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4" viewBox="0 0 32 16">
                                    <path d="M4 8 Q8 4 12 8 Q16 12 20 8 Q24 4 28 8" stroke="currentColor" strokeWidth="2" fill="none" className="text-foreground" />
                                </svg>
                            </span>
                            <span> Together with</span>
                            <br />
                            <span className="relative inline-block text-primary font-extrabold drop-shadow-sm">
                                AI
                                {/* Decorative dot */}
                                <span className="absolute -right-4 top-0 w-2 h-2 bg-primary rounded-full" />
                            </span>
                            <span className="italic">.</span>
                        </h1>

                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                            Unlock your full academic potential. StudyBuddy brings intelligent scheduling,
                            seamless collaboration, and AI-powered insights into one powerful workspace designed for students.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex items-center justify-center gap-4">
                            <Button
                                onClick={handleGetStarted}
                                className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-base"
                                disabled={isLoading}
                            >
                                {user ? 'Go to Dashboard' : 'Get Started'}
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-full px-6 py-6 text-base border-foreground/20 hover:bg-foreground/5"
                            >
                                How It Works <Play className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>

                    {/* Features Section */}
                    <div className="mt-32 max-w-7xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-300 dark:to-indigo-300">
                                Everything you need to excel
                            </h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Powerful tools designed to help you study smarter, not harder.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                            {[
                                {
                                    title: "Smart Scheduling",
                                    desc: "Auto-adaptable calendar that manages your study time.",
                                    icon: Calendar,
                                    color: "text-purple-500",
                                    bg: "bg-purple-500/10"
                                },
                                {
                                    title: "Deep Analytics",
                                    desc: "Track your progress with detailed performance metrics.",
                                    icon: TrendingUp,
                                    color: "text-blue-500",
                                    bg: "bg-blue-500/10"
                                },
                                {
                                    title: "AI Assistant",
                                    desc: "24/7 personalized tutoring for any subject.",
                                    icon: Target,
                                    color: "text-emerald-500",
                                    bg: "bg-emerald-500/10"
                                },
                                {
                                    title: "Collaboration",
                                    desc: "Study together in real-time with your peers.",
                                    icon: Users,
                                    color: "text-violet-500",
                                    bg: "bg-violet-500/10"
                                }
                            ].map((feature, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    className="group relative bg-card/50 hover:bg-card border border-border/50 hover:border-border rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="relative z-10">
                                        <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                                            <feature.icon className={`w-6 h-6 ${feature.color}`} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            {feature.desc}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Android App Download & Waitlist Section */}
                    {!isNativeApp && (
                        <div className="mt-32 max-w-5xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6 }}
                                className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/30 backdrop-blur-md"
                            >
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                                <div className="relative z-10 p-8 md:p-12">
                                    {/* Update Badge */}
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                            </span>
                                            <span className="text-xs font-bold text-primary tracking-wide uppercase">New Update Incoming</span>
                                        </div>
                                        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                                    </div>

                                    <div className="flex flex-col lg:flex-row gap-12 items-center">
                                        {/* Left: Content & Waitlist */}
                                        <div className="flex-1 text-center lg:text-left">
                                            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                                                <Smartphone className="w-8 h-8 text-indigo-500" />
                                                <h2 className="text-3xl md:text-4xl font-bold">
                                                    StudyBuddy Native
                                                </h2>
                                            </div>

                                            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto lg:mx-0">
                                                We're bringing the ultimate study experience directly to your pocket.
                                                Native performance, offline support, and push notifications are on the way.
                                            </p>

                                            {/* Feature Highlights */}
                                            <div className="grid grid-cols-2 gap-4 mb-8 text-left max-w-xl mx-auto lg:mx-0">
                                                {[
                                                    { icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, text: "120 FPS Fluid Animations" },
                                                    { icon: <CheckCircle className="w-4 h-4 text-blue-500" />, text: "Offline Mode" },
                                                    { icon: <Target className="w-4 h-4 text-purple-500" />, text: "Focus Mode Integrations" },
                                                    { icon: <Users className="w-4 h-4 text-orange-500" />, text: "Real-time Sync" },
                                                ].map((feat, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm border border-border/50">
                                                            {feat.icon}
                                                        </div>
                                                        {feat.text}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Waitlist Form */}
                                            <div className="max-w-md mx-auto lg:mx-0 bg-background/50 p-6 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                                                <h3 className="font-semibold text-foreground mb-1">Get Early Access</h3>
                                                <p className="text-sm text-muted-foreground mb-4">Join 2,000+ students waiting for the beta release.</p>

                                                <AnimatePresence mode="wait">
                                                    {waitlistStatus === 'success' ? (
                                                        <motion.div
                                                            key="success"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
                                                        >
                                                            <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                                                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                                {waitlistMessage}
                                                            </p>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.form
                                                            key="form"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            onSubmit={handleWaitlistSubmit}
                                                            className="flex flex-col gap-3"
                                                        >
                                                            <div className="relative">
                                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                                <input
                                                                    type="email"
                                                                    placeholder="Enter your email"
                                                                    value={waitlistEmail}
                                                                    onChange={(e) => {
                                                                        setWaitlistEmail(e.target.value);
                                                                        if (waitlistStatus === 'error') setWaitlistStatus('idle');
                                                                    }}
                                                                    required
                                                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                                                                />
                                                            </div>
                                                            <Button
                                                                type="submit"
                                                                disabled={waitlistStatus === 'loading' || !waitlistEmail.trim()}
                                                                className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90 py-3 text-sm font-semibold transition-all disabled:opacity-50"
                                                            >
                                                                {waitlistStatus === 'loading' ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                ) : null}
                                                                Join the Waitlist
                                                            </Button>
                                                        </motion.form>
                                                    )}
                                                </AnimatePresence>

                                                <AnimatePresence>
                                                    {waitlistStatus === 'error' && (
                                                        <motion.p
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="text-xs text-red-500 mt-3 text-center"
                                                        >
                                                            {waitlistMessage}
                                                        </motion.p>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Right: Abstract Phone Visual */}
                                        <div className="hidden lg:flex flex-col items-center justify-center w-[300px]">
                                            <motion.div
                                                initial={{ y: 20, opacity: 0 }}
                                                whileInView={{ y: 0, opacity: 1 }}
                                                transition={{ duration: 0.8, delay: 0.2 }}
                                                className="relative w-64 h-[500px] bg-background rounded-[3rem] border-8 border-foreground/10 shadow-2xl overflow-hidden flex flex-col"
                                            >
                                                {/* Notch */}
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/10 rounded-b-xl z-20" />

                                                {/* Screen Content */}
                                                <div className="flex-1 p-6 flex flex-col pt-12 relative z-10">
                                                    {/* Fake Dashboard */}
                                                    <div className="w-3/4 h-6 bg-border/50 rounded-lg mb-6" />

                                                    <div className="space-y-4 flex-1">
                                                        <div className="w-full h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex p-4 shadow-sm border border-border/30">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 mb-auto" />
                                                            <div className="ml-3 flex-1">
                                                                <div className="w-2/3 h-3 bg-indigo-500/20 rounded mb-2" />
                                                                <div className="w-1/2 h-2 bg-indigo-500/10 rounded" />
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center p-3 animate-pulse">
                                                            <div className="w-8 h-8 rounded-full bg-border/50" />
                                                            <div className="ml-3 flex-1">
                                                                <div className="w-3/4 h-2 bg-border/50 rounded mb-2" />
                                                                <div className="w-1/2 h-2 bg-border/30 rounded" />
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center p-3">
                                                            <div className="w-8 h-8 rounded-full bg-border/50" />
                                                            <div className="ml-3 flex-1">
                                                                <div className="w-2/3 h-2 bg-border/50 rounded mb-2" />
                                                                <div className="w-1/3 h-2 bg-border/30 rounded" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Gradient Overlay for visual effect */}
                                                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-8 border-t bg-background/50 backdrop-blur-sm">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Logo className="w-5 h-5" />
                            <span className="text-sm text-muted-foreground">© 2025 StudyBuddy. All rights reserved.</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                Privacy
                            </a>
                            <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                Terms
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </UnifiedPageWrapper>
    );
}

