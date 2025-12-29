import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Users, BarChart3, Clock, Brain, Target, ChevronRight, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { API_URL } from '@/config/api';
import { soundManager } from '@/lib/sounds';

const SLIDING_TAGLINES = [
  "Study smarter, not harder.",
  "Turn your goals into daily actionable plans.",
  "Consistency made simple with AI-driven routines.",
  "Track, plan, and level up—effortlessly.",
  "Where discipline meets intelligent automation.",
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Planning',
    description: 'Get personalized study plans based on your goals, patterns, and exam timeline.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Clock,
    title: 'Smart Study Timer',
    description: 'Track focus sessions with Pomodoro timer, earn points, and build consistent habits.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Users,
    title: 'Community Support',
    description: 'Connect with peers, share progress, and stay motivated together.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics',
    description: 'Visualize your progress with beautiful charts and actionable insights.',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: Target,
    title: 'Goal Tracking',
    description: 'Set milestones, track achievements, and celebrate your wins.',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: Zap,
    title: 'Real-time Sync',
    description: 'Your data syncs instantly across all devices, always up to date.',
    gradient: 'from-indigo-500 to-violet-500',
  },
];

const STATS = [
  { value: '10K+', label: 'Active Students' },
  { value: '500K+', label: 'Study Hours' },
  { value: '95%', label: 'Success Rate' },
  { value: '4.9', label: 'User Rating', icon: Star },
];

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTaglineIndex((prev) => (prev + 1) % SLIDING_TAGLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGetStarted = () => {
    if (isLoading) return;
    setIsLoading(true);
    soundManager.playClick();
    window.location.href = `${API_URL}/api/auth/google`;
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30 transition-all duration-1000"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`,
        }}
      />
      
      {/* Floating Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-float animation-delay-200" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float animation-delay-400" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <Logo className="w-8 h-8 relative" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              StudyBuddy
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button 
              onClick={handleGetStarted} 
              variant="ghost" 
              disabled={isLoading}
              className="hidden sm:flex items-center gap-2 hover:bg-primary/10"
            >
              Sign in
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-20 pb-32 max-w-7xl">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 mb-8 animate-bounce-in">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                AI-Powered Study Platform
              </span>
            </div>
            
            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-slide-up">
              Your Personal
              <span className="block mt-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                AI Study Mentor
              </span>
            </h1>
            
            {/* Sliding Tagline */}
            <div className="h-10 mb-8 overflow-hidden">
              <p 
                key={currentTaglineIndex}
                className="text-xl sm:text-2xl font-medium text-violet-600 dark:text-violet-400 animate-slide-up"
              >
                {SLIDING_TAGLINES[currentTaglineIndex]}
              </p>
            </div>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto animate-slide-up animation-delay-100">
              StudyBuddy understands your study patterns, analyzes your goals, and builds a 
              personalized preparation path for JEE, NEET, UPSC & more.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slide-up animation-delay-200">
              <Button 
                onClick={handleGetStarted} 
                size="lg" 
                disabled={isLoading} 
                className="relative group px-8 py-6 text-lg font-semibold rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 hover:-translate-y-1"
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Start Your Journey
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
              <Button 
                onClick={handleGetStarted} 
                size="lg" 
                variant="outline" 
                disabled={isLoading}
                className="px-8 py-6 text-lg font-semibold rounded-2xl border-2 hover:bg-primary/5 transition-all duration-300"
              >
                Explore Dashboard
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-slide-up animation-delay-300">
              <div className="flex -space-x-2">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 border-2 border-background flex items-center justify-center text-white text-xs font-bold">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span className="ml-2">Join 10,000+ students already studying smarter</span>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="container mx-auto px-6 pb-24 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, index) => (
              <div 
                key={stat.label}
                className="relative group p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-violet-500/10"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-1 text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    {stat.value}
                    {stat.icon && <Star className="h-5 w-5 text-amber-500 fill-amber-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />
          <div className="container mx-auto px-6 max-w-7xl relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Everything you need to
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent"> succeed</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to help you achieve your academic goals
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={feature.title}
                    className="group relative p-8 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-500/10"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="font-bold text-xl mb-3 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-24 max-w-7xl">
          <div className="relative rounded-[2.5rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 animate-gradient bg-[length:200%_auto]" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMThjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTE4IDBjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center text-white">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Ready to transform your study routine?
              </h2>
              <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Join thousands of students who are achieving their goals with StudyBuddy's intelligent study system.
              </p>
              <Button 
                onClick={handleGetStarted} 
                size="lg" 
                disabled={isLoading}
                className="px-10 py-6 text-lg font-semibold rounded-2xl bg-white text-violet-600 hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-50" />
                  <Logo className="w-8 h-8 relative" />
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  StudyBuddy
                </span>
              </div>
              <p className="text-muted-foreground max-w-sm">
                Your Personal AI Study Mentor. Transform your study routine with intelligent planning and real-time insights.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <div className="space-y-3">
                <a href="/privacy" className="block text-muted-foreground hover:text-violet-600 transition-colors">
                  Privacy Policy
                </a>
                <a href="/terms" className="block text-muted-foreground hover:text-violet-600 transition-colors">
                  Terms & Conditions
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-3">
                <button 
                  onClick={handleGetStarted} 
                  className="block text-muted-foreground hover:text-violet-600 transition-colors text-left"
                  disabled={isLoading}
                >
                  Get Started
                </button>
                <button 
                  onClick={handleGetStarted} 
                  className="block text-muted-foreground hover:text-violet-600 transition-colors text-left"
                  disabled={isLoading}
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 pt-8">
            <p className="text-sm text-muted-foreground text-center">
              © 2025 StudyBuddy. All rights reserved. Made with 💜 for students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
