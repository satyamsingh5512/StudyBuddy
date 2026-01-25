import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { Play, ChevronDown, Check, MoreVertical, Users, MessageSquare, Folder } from 'lucide-react';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';

export default function Landing() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleGetStarted = () => {
        if (isLoading) return;
        setIsLoading(true);
        navigate('/auth');
    };

    return (
        <UnifiedPageWrapper>
            {/* Header */}
            <header className="relative z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between max-w-7xl">
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-foreground" highlighted />
                        <span className="font-semibold text-lg tracking-wider uppercase" style={{ letterSpacing: '0.2em' }}>
                            StudyBuddy
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Resource <ChevronDown className="w-3 h-3" />
                        </button>
                        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Product <ChevronDown className="w-3 h-3" />
                        </button>
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </button>
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Support
                        </button>
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            About Us
                        </button>
                    </nav>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <Button
                            onClick={handleGetStarted}
                            className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-6"
                            disabled={isLoading}
                        >
                            Sign In
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
                            <span className="italic">Write your Task</span>
                            <span className="relative inline-block mx-2">
                                .
                                {/* Decorative squiggle under the period */}
                                <svg className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4" viewBox="0 0 32 16">
                                    <path d="M4 8 Q8 4 12 8 Q16 12 20 8 Q24 4 28 8" stroke="currentColor" strokeWidth="2" fill="none" className="text-foreground" />
                                </svg>
                            </span>
                            <span> so that</span>
                            <br />
                            <span>your mind is </span>
                            <span className="relative inline-block">
                                empty
                                {/* Decorative dot */}
                                <span className="absolute -right-4 top-0 w-2 h-2 bg-foreground rounded-full" />
                            </span>
                            <span className="italic">.</span>
                        </h1>

                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                            Do you want to be on top of your schedule? It's hard to imagine achieving this without
                            using some digital assistance. Here's task management app that helps to be more
                            productive any time.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex items-center justify-center gap-4">
                            <Button
                                onClick={handleGetStarted}
                                className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-base"
                                disabled={isLoading}
                            >
                                Get Start
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-full px-6 py-6 text-base border-foreground/20 hover:bg-foreground/5"
                            >
                                How It Work <Play className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>
                    {/* Floating Cards Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="relative max-w-7xl mx-auto h-auto md:h-[450px] flex flex-col md:block items-center gap-8 md:gap-0 py-12 md:py-0 px-4 md:px-0"
                    >
                        {/* Yellow Glow in Center */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-96 md:h-96 bg-gradient-radial from-yellow-300/40 via-yellow-200/20 to-transparent dark:from-yellow-500/20 dark:via-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Left Card - Project Card */}
                        <motion.div
                            initial={{ opacity: 0, x: -50, rotate: -8 }}
                            animate={{ opacity: 1, x: 0, rotate: -8 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="relative md:absolute md:left-[2%] md:top-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-64 z-10"
                        >
                            <div className="bg-card border-2 border-dashed border-border rounded-2xl p-5 shadow-xl">
                                <div className="flex items-start justify-between mb-4">
                                    <span className="px-3 py-1 bg-orange-400 text-white text-xs font-medium rounded-full">
                                        UX Designer
                                    </span>
                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </div>

                                <h3 className="font-semibold mb-2">Dribbble Inspiration</h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Exploration for ios design dashboard drown for EN, color and white color can be clean design
                                </p>

                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex -space-x-2">
                                        <div className="w-7 h-7 rounded-full bg-pink-300 border-2 border-card" />
                                        <div className="w-7 h-7 rounded-full bg-blue-300 border-2 border-card" />
                                        <div className="w-7 h-7 rounded-full bg-green-300 border-2 border-card" />
                                        <div className="w-7 h-7 rounded-full bg-yellow-300 border-2 border-card" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-orange-500">
                                        <div className="w-3 h-3 border-2 border-orange-500 rounded-full" />
                                        <span className="text-xs font-medium">Progress</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">0/4</span>
                                </div>

                                <div className="flex items-center gap-4 mt-4 pt-4 border-t text-muted-foreground">
                                    <MessageSquare className="w-4 h-4" />
                                    <Users className="w-4 h-4" />
                                    <Folder className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Decorative star - Hidden on mobile to reduce clutter, or adjust position */}
                            <svg className="absolute -top-6 -right-6 w-6 h-6 hidden md:block" viewBox="0 0 24 24">
                                <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="currentColor" className="text-foreground" />
                            </svg>
                        </motion.div>

                        {/* NEW 4th Card - Study Group (Second Position) */}
                        <motion.div
                            initial={{ opacity: 0, y: 40, rotate: -4 }}
                            animate={{ opacity: 1, y: 0, rotate: -4 }}
                            transition={{ duration: 0.6, delay: 0.45 }}
                            className="relative md:absolute md:left-[26%] md:top-[65%] md:-translate-y-1/2 w-full max-w-[240px] md:w-56 z-20"
                        >
                            <div className="bg-card border-2 border-dashed border-border rounded-2xl p-4 shadow-xl backdrop-blur-sm bg-card/90">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="font-semibold text-sm">Study Group</span>
                                    </div>
                                    <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">Math Finals Prep</p>
                                <div className="flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-card flex items-center justify-center text-[10px] font-bold">JD</div>
                                        <div className="w-8 h-8 rounded-full bg-teal-200 border-2 border-card flex items-center justify-center text-[10px] font-bold">AS</div>
                                        <div className="w-8 h-8 rounded-full bg-card border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px]">+3</div>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                                        Join
                                    </Button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Center Card - Today Tasks */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                            className="relative md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-72 z-10"
                        >
                            <div className="bg-card border-2 border-dashed border-border rounded-2xl p-5 shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-semibold text-lg">Today</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                                            <span className="text-xs">#</span>
                                        </div>
                                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                                            <span className="text-xs">@</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { text: 'Job Interview', checked: true },
                                        { text: 'Send Resume', checked: true },
                                        { text: 'Shopping for Home', checked: false },
                                        { text: 'Portfolio Design', checked: true },
                                        { text: 'Traveling with family', checked: false },
                                        { text: 'Start New project', checked: false },
                                    ].map((task, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded flex items-center justify-center ${task.checked
                                                ? 'bg-emerald-500 text-white'
                                                : 'border-2 border-border'
                                                }`}>
                                                {task.checked && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className={`text-sm ${task.checked ? '' : 'text-muted-foreground'}`}>
                                                {task.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Decorative star - Hidden on mobile */}
                            <svg className="absolute -bottom-8 -right-8 w-5 h-5 hidden md:block" viewBox="0 0 24 24">
                                <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="currentColor" className="text-foreground" />
                            </svg>

                            {/* Connecting Line - Hidden on mobile */}
                            <svg className="absolute top-1/2 -left-16 w-16 h-20 -translate-y-1/2 hidden md:block">
                                <path d="M64 40 Q32 20 0 30" stroke="currentColor" strokeWidth="2" fill="none" className="text-foreground/30" />
                            </svg>
                        </motion.div>

                        {/* Right Card - Dashboard Preview */}
                        <motion.div
                            initial={{ opacity: 0, x: 50, rotate: 8 }}
                            animate={{ opacity: 1, x: 0, rotate: 8 }}
                            transition={{ duration: 0.6, delay: 0.6 }}
                            className="relative md:absolute md:right-[2%] md:top-1/2 md:-translate-y-1/2 w-full max-w-[280px] md:w-64"
                        >
                            <div className="bg-card border-2 border-dashed border-border rounded-2xl overflow-hidden shadow-xl">
                                {/* Mini Dashboard Header */}
                                <div className="bg-gradient-to-r from-emerald-400 to-teal-500 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-white/50" />
                                        <div className="w-2 h-2 rounded-full bg-white/50" />
                                        <div className="w-2 h-2 rounded-full bg-white/50" />
                                    </div>
                                    <div className="bg-white/20 rounded p-2">
                                        <div className="flex justify-between text-white text-xs font-medium">
                                            <span>Company Statistics</span>
                                            <span>4.57%</span>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <div className="bg-purple-500 rounded px-2 py-1 text-white text-xs">54</div>
                                            <div className="flex-1 h-6 bg-white/30 rounded" />
                                        </div>
                                    </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-4">
                                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                                        UI Designer
                                    </span>

                                    <h3 className="font-semibold mt-3 mb-1">Dribbble Inspiration</h3>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Inspiration for ios design Sam's design for EN color color can be clean design
                                    </p>

                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex -space-x-2">
                                            <div className="w-6 h-6 rounded-full bg-pink-300 border-2 border-card" />
                                            <div className="w-6 h-6 rounded-full bg-blue-300 border-2 border-card" />
                                            <div className="w-6 h-6 rounded-full bg-green-300 border-2 border-card" />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-emerald-500">
                                            <div className="w-3 h-3 border-2 border-emerald-500 rounded-full" />
                                            <span className="text-xs font-medium">Progress</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">0/4</span>
                                    </div>
                                </div>
                            </div>
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
