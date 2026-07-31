import { useNavigate } from '@/lib/router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';

const sections = [
  {
    title: 'Data we collect',
    text: 'Account details such as name, email, username and avatar; study goals, tasks, schedules, notes, timer sessions and reports; and social data such as friend requests, messages, blocks and leaderboard preferences.',
  },
  {
    title: 'How we use data',
    text: 'We use this information to authenticate you, provide study planning and analytics, operate social features, prevent abuse, troubleshoot reliability and improve the product.',
  },
  {
    title: 'AI features',
    text: 'Prompts and relevant study context may be sent to configured AI providers when you request generated schedules, news or search results. Do not include sensitive personal information in prompts.',
  },
  {
    title: 'Analytics and storage',
    text: 'The web application uses hosting analytics and stores necessary preferences such as theme locally. Authentication uses secure cookies. Application data is stored in MongoDB and processed by our hosting and email providers.',
  },
  {
    title: 'Sharing and sale',
    text: 'We share data only with service providers needed to operate StudyBuddy or when required by law. We do not sell personal data.',
  },
  {
    title: 'Retention and control',
    text: 'We retain information while your account is active and as needed for security and legal obligations. You can adjust profile visibility and request access, correction or deletion by contacting support.',
  },
];

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <UnifiedPageWrapper>
      <div className="flex min-h-screen flex-col">
        <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0">
          <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="font-medium">StudyBuddy</span>
            </div>
            <Button onClick={() => navigate('/')} size="sm" variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to home
            </Button>
          </div>
        </header>
        <main className="container mx-auto max-w-3xl flex-1 px-6 py-12">
          <h1 className="text-3xl font-bold">Privacy policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 1 August 2026</p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            This notice explains what StudyBuddy processes and why. We collect data needed to
            provide the service, protect accounts and understand reliability.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
              </section>
            ))}
          </div>
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For privacy questions or account requests, email{' '}
              <a
                href="mailto:studybuddy5512@gmail.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                studybuddy5512@gmail.com
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </UnifiedPageWrapper>
  );
}
