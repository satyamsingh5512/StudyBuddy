import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
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

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);

  // Rotate taglines every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTaglineIndex((prev) => (prev + 1) % SLIDING_TAGLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    if (isLoading) return;
    
    setIsLoading(true);
    soundManager.playClick();
    
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleExploreDashboard = () => {
    if (isLoading) return;
    
    setIsLoading(true);
    soundManager.playClick();
    
    window.location.href = `${API_URL}/api/auth/google`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5" />
            <span className="font-medium">StudyBuddy</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={handleGetStarted} size="sm" variant="ghost" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Sign in'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-32 pb-24 max-w-7xl">
          <div className="max-w-3xl">
            {/* Main Tagline - Static */}
            <h1 className="text-6xl font-bold tracking-tight leading-[1.1] mb-4">
              Your Personal AI Study Mentor
            </h1>
            
            {/* Sliding Tagline */}
            <div className="h-10 mb-6 overflow-hidden">
              <p 
                key={currentTaglineIndex}
                className="text-2xl font-medium text-primary animate-slide-up"
              >
                {SLIDING_TAGLINES[currentTaglineIndex]}
              </p>
            </div>

            {/* Subheading */}
            <p className="text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              StudyBuddy understands your study patterns, analyzes your goals, and builds a 
              personalized preparation path for exams
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center gap-4 mb-6">
              <Button onClick={handleGetStarted} size="lg" disabled={isLoading} className="text-base px-8">
                {isLoading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    Start Your Journey
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <Button 
                onClick={handleExploreDashboard} 
                size="lg" 
                variant="outline" 
                disabled={isLoading}
                className="text-base px-8"
              >
                {isLoading ? 'Connecting...' : 'Explore the Dashboard'}
              </Button>
            </div>

            {/* Supporting Line */}
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Trusted, intelligent, and beautifully simple.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-6 py-24 max-w-7xl">
            <h2 className="text-3xl font-bold mb-12">
              Everything you need to succeed
            </h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2 text-lg">AI-Powered Planning</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get personalized study plans based on your goals, patterns, and exam timeline.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2 text-lg">Smart Study Timer</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Track focus sessions with Pomodoro timer, earn points, and build consistent habits.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2 text-lg">Community Support</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Connect with peers, share progress, and stay motivated together.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="container mx-auto px-6 py-24 max-w-7xl">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-bold tracking-tight mb-4">
                Ready to transform your study routine?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of students who are achieving their goals with StudyBuddy&apos;s intelligent study system.
              </p>
              <Button onClick={handleGetStarted} size="lg" disabled={isLoading} className="text-base px-8">
                {isLoading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    Start Your Journey
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Logo className="w-5 h-5" />
                <span className="font-semibold">StudyBuddy</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your Personal AI Study Mentor
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <div className="space-y-2">
                <a href="/privacy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
                <a href="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms & Conditions
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <div className="space-y-2">
                <button 
                  type="button"
                  onClick={handleGetStarted} 
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  disabled={isLoading}
                >
                  Get Started
                </button>
                <button 
                  type="button"
                  onClick={handleExploreDashboard} 
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  disabled={isLoading}
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>
          <div className="border-t pt-8">
            <p className="text-sm text-muted-foreground text-center">
              © 2025 StudyBuddy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
