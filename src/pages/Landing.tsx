import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/atoms';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { Play, Users, MessageSquare, Folder, TrendingUp, Calendar, Target, BarChart3, Clock, Award } from 'lucide-react';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';

export default function Landing() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const user = useAtomValue(userAtom);

    const handleGetStarted = () => {
        if (isLoading) return;
        if (user) {
            navigate('/dashboard');
            return;
        }
        setIsLoading(true);
        navigate('/auth');
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
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Support
                        </button>
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
                    {/* Floating Cards Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="relative max-w-7xl mx-auto h-auto md:h-[450px] flex flex-col md:block items-center gap-6 md:gap-0 py-12 md:py-0 px-4 md:px-0"
                    >
                        {/* Yellow Glow in Center */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-96 md:h-96 bg-gradient-radial from-yellow-300/40 via-yellow-200/20 to-transparent dark:from-yellow-500/20 dark:via-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Left Card - Analytics Dashboard */}
                        <motion.div
                            initial={{ opacity: 0, x: -50, rotate: -8 }}
                            animate={{ opacity: 1, x: 0, rotate: -8 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="relative md:absolute md:left-[2%] md:top-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-64 z-10 order-4 md:order-none"
                        >
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-xl backdrop-blur-sm">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">Performance</h3>
                                            <p className="text-xs text-muted-foreground">Last 7 days</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                                        +24%
                                    </span>
                                </div>

                                {/* Mini Chart */}
                                <div className="mb-4">
                                    <div className="flex items-end justify-between h-20 gap-1">
                                        {[40, 65, 45, 80, 60, 90, 75].map((height, i) => (
                                            <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t" style={{ height: `${height}%` }} />
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                                        <span>Mon</span>
                                        <span>Tue</span>
                                        <span>Wed</span>
                                        <span>Thu</span>
                                        <span>Fri</span>
                                        <span>Sat</span>
                                        <span>Sun</span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-3 border-t">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-xs text-muted-foreground">Study Hours</span>
                                        </div>
                                        <span className="text-xs font-semibold">42.5h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs text-muted-foreground">Tasks Done</span>
                                        </div>
                                        <span className="text-xs font-semibold">127</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            <span className="text-xs text-muted-foreground">Accuracy</span>
                                        </div>
                                        <span className="text-xs font-semibold">94.2%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative element */}
                            <div className="absolute -top-3 -right-3 w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-sm opacity-60 hidden md:block" />
                        </motion.div>

                        {/* Second Card - Smart Schedule */}
                        <motion.div
                            initial={{ opacity: 0, y: 40, rotate: -4 }}
                            animate={{ opacity: 1, y: 0, rotate: -4 }}
                            transition={{ duration: 0.6, delay: 0.45 }}
                            className="relative md:absolute md:left-[26%] md:top-[65%] md:-translate-y-1/2 w-full max-w-[240px] md:w-56 z-20 order-3 md:order-none"
                        >
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-xl backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                                            <Calendar className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="font-semibold text-sm">Smart Schedule</span>
                                    </div>
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                </div>

                                <div className="space-y-2 mb-3">
                                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                        <div className="w-1 h-8 bg-blue-500 rounded-full" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium">Physics - Mechanics</p>
                                            <p className="text-[10px] text-muted-foreground">09:00 - 10:30 AM</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                                        <div className="w-1 h-8 bg-purple-500 rounded-full" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium">Chemistry Lab</p>
                                            <p className="text-[10px] text-muted-foreground">11:00 AM - 12:30 PM</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t">
                                    <span className="text-xs text-muted-foreground">Next: Math</span>
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">in 45 min</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Center Card - AI-Powered Insights */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                            className="relative md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-72 z-30 order-1 md:order-none mb-6 md:mb-0"
                        >
                            <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                                            <Target className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">AI Insights</h3>
                                            <p className="text-xs text-muted-foreground">Personalized for you</p>
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                                        <span className="text-xs text-white font-bold">AI</span>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-2">
                                            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Strong Performance</p>
                                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                    You're excelling in Chemistry! Keep up the momentum.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                                        <div className="flex items-start gap-2">
                                            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Focus Area</p>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                                    Spend 30 more minutes on Physics this week.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                        <div className="flex items-start gap-2">
                                            <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Study Pattern</p>
                                                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                                                    Your best study time is 9-11 AM. Schedule key topics then.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t">
                                    <span className="text-xs text-muted-foreground">Updated 2 min ago</span>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 hover:bg-primary/10">
                                        View All
                                    </Button>
                                </div>
                            </div>

                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl blur-xl -z-10" />
                        </motion.div>

                        {/* Right Card - Collaboration Hub */}
                        <motion.div
                            initial={{ opacity: 0, x: 50, rotate: 8 }}
                            animate={{ opacity: 1, x: 0, rotate: 8 }}
                            transition={{ duration: 0.6, delay: 0.6 }}
                            className="relative md:absolute md:right-[2%] md:top-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-64 order-2 md:order-none"
                        >
                            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                                {/* Header with gradient */}
                                <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                                <Users className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="text-white font-semibold text-sm">Team Workspace</span>
                                        </div>
                                        <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                                    </div>
                                    <p className="text-white/80 text-xs">5 active members</p>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <div className="space-y-3 mb-4">
                                        {/* Active Discussion */}
                                        <div className="flex items-start gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                AK
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-medium truncate">Arjun Kumar</p>
                                                    <span className="text-[10px] text-muted-foreground">2m ago</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Shared notes on Organic Chemistry
                                                </p>
                                            </div>
                                        </div>

                                        {/* File Shared */}
                                        <div className="flex items-start gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                PS
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-medium truncate">Priya Sharma</p>
                                                    <span className="text-[10px] text-muted-foreground">15m ago</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 p-1.5 bg-muted rounded text-xs">
                                                    <Folder className="w-3 h-3" />
                                                    <span className="truncate">Physics_Notes.pdf</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Session */}
                                        <div className="p-2 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 rounded-lg border border-red-200 dark:border-red-800">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                                <span className="text-xs font-medium text-red-900 dark:text-red-100">Live Study Session</span>
                                            </div>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                                Math Problem Solving - Join now
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-3 border-t">
                                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                                            <MessageSquare className="w-3 h-3 mr-1" />
                                            Chat
                                        </Button>
                                        <Button size="sm" className="flex-1 h-8 text-xs bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600">
                                            Join
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative glow */}
                            <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-purple-400 to-fuchsia-500 rounded-full blur-lg opacity-50 hidden md:block" />
                        </motion.div>
                    </motion.div>
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
