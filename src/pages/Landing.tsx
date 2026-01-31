import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Users, TrendingUp, Calendar, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import { userAtom } from '@/store/atoms';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
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
