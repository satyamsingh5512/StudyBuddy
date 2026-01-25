import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <UnifiedPageWrapper>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/60 backdrop-blur-md sticky top-0 z-10">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-4xl">
            <div className="flex items-center gap-2">
              <Logo className="w-5 h-5" />
              <span className="font-medium">StudyBuddy</span>
            </div>
            <Button onClick={() => navigate('/')} size="sm" variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              At StudyBuddy, we believe your data belongs to you. We collect only what is strictly necessary to make the app work.
            </p>

            <div className="grid gap-6 md:grid-cols-2 mt-8">
              <div className="bg-muted/30 p-6 rounded-2xl border">
                <h3 className="font-semibold text-lg mb-2">What We Collect</h3>
                <ul className="list-disc pl-4 space-y-2 text-sm text-muted-foreground">
                  <li>Basic Google profile info (Name, Email, Photo) for login.</li>
                  <li>Your study goals and progress data to generate stats.</li>
                </ul>
              </div>

              <div className="bg-muted/30 p-6 rounded-2xl border">
                <h3 className="font-semibold text-lg mb-2">How We Use It</h3>
                <ul className="list-disc pl-4 space-y-2 text-sm text-muted-foreground">
                  <li>To verify your identity.</li>
                  <li>To calculate your study streaks and leaderboard position.</li>
                  <li>We do <strong>not</strong> sell your data to anyone.</li>
                </ul>
              </div>
            </div>

            <p className="text-sm text-muted-foreground pt-4">
              You can request account deletion at any time by contacting us at <a href="mailto:studybuddy5512@gmail.com" className="text-primary hover:underline">studybuddy5512@gmail.com</a>.
            </p>
          </div>
        </main>
      </div>
    </UnifiedPageWrapper>
  );
}
