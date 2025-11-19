import { Button } from '@/components/ui/button';
import { ArrowRight, Github } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

export default function Landing() {
  const handleGetStarted = async () => {
    try {
      const response = await fetch('/api/auth/google', { credentials: 'include' });
      if (response.status === 503) {
        alert(
          'Authentication is not configured yet.\n\n' +
            'Please set up Google OAuth credentials in the .env file.\n' +
            'See SETUP.md for instructions.'
        );
      } else {
        window.location.href = '/api/auth/google';
      }
    } catch (error) {
      window.location.href = '/api/auth/google';
    }
  };

  const features = [
    'AI study plan generation',
    'Task management with priorities',
    'Pomodoro timer integration',
    'Weekly schedule planner',
    'Progress tracking & analytics',
    'Leaderboard & gamification',
    'Real-time community chat',
    'Exam notifications',
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5" />
            <span className="font-semibold">StudyBuddy</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github className="h-5 w-5" />
            </a>
            <Button onClick={handleGetStarted} size="sm">
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-24 max-w-4xl">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Study platform for competitive exams
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Track your progress, manage tasks, and get AI-generated study plans. Built for JEE,
              NEET, UPSC, and other exam prep.
            </p>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleGetStarted} className="gap-2">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" asChild>
                <a href="#features">View features</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t py-24">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl font-semibold mb-8">What's included</h2>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
              {features.map((feature, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-muted-foreground mt-0.5">→</div>
                  <div>{feature}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="border-t py-24 bg-muted/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl font-semibold mb-8">Built with</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="font-medium mb-2">Frontend</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>React + TypeScript</div>
                  <div>Tailwind CSS</div>
                  <div>Framer Motion</div>
                </div>
              </div>
              <div>
                <div className="font-medium mb-2">Backend</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Node.js + Express</div>
                  <div>PostgreSQL + Prisma</div>
                  <div>Socket.io</div>
                </div>
              </div>
              <div>
                <div className="font-medium mb-2">Services</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Google OAuth</div>
                  <div>Gemini AI</div>
                  <div>Neon Database</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t py-24">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-2xl font-semibold mb-4">Ready to start?</h2>
            <p className="text-muted-foreground mb-8">
              Sign in with Google to access your dashboard
            </p>
            <Button onClick={handleGetStarted} size="lg" className="gap-2">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with React, TypeScript, and Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
