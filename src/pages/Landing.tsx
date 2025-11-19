import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
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
            <Button onClick={handleGetStarted} size="sm" variant="ghost">
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-32 pb-24 max-w-6xl">
          <div className="max-w-3xl">
            <h1 className="text-6xl font-semibold tracking-tight leading-[1.1] mb-6">
              Todo list with
              <br />
              community support
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl">
              Organize your tasks and connect with peers from your school or college. Stay
              productive together.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={handleGetStarted} size="lg">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Free, no credit card required</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t">
          <div className="container mx-auto px-6 py-24 max-w-6xl">
            <div className="grid md:grid-cols-3 gap-16">
              <div>
                <h3 className="font-medium mb-2">Task management</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create, organize, and track your daily tasks with a clean interface.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Community chat</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Connect with students from your school or college in dedicated chat rooms.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Study timer</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Stay focused with built-in Pomodoro timer and session tracking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="container mx-auto px-6 py-24 max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight mb-4">
                Start organizing with your community
              </h2>
              <p className="text-muted-foreground mb-6">
                Join students using StudyBuddy to manage tasks and stay connected.
              </p>
              <Button onClick={handleGetStarted} size="lg">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>© 2024 StudyBuddy</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
