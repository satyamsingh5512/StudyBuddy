import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';

export default function Terms() {
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
        <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl glass-card my-8 rounded-xl">
          <h1 className="text-4xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-muted-foreground mb-8">Last updated: November 20, 2025</p>

          <div className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold mb-3">Agreement to Terms</h2>
              <p>
                By accessing and using StudyBuddy, you agree to be bound by these Terms and Conditions.
                If you do not agree with any part of these terms, you may not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Use of Service</h2>
              <p>StudyBuddy provides an AI-powered study planning platform to help students achieve their academic goals.</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>You must be at least 13 years old to use this service (with parental consent if under 18)</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You agree to provide accurate and complete information</li>
                <li>You will not use the service for any illegal or unauthorized purpose</li>
                <li>You will not attempt to hack, disrupt, or interfere with the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">User Account</h2>
              <p>
                When you create an account through Google OAuth, you are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Keeping your login credentials secure</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
                <li>Ensuring your account information remains accurate and up-to-date</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Acceptable Use</h2>
              <p>You agree NOT to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Share inappropriate, offensive, or harmful content</li>
                <li>Harass, bully, or threaten other users</li>
                <li>Impersonate others or create fake accounts</li>
                <li>Attempt to gain unauthorized access to other accounts</li>
                <li>Use automated bots or scripts to access the service</li>
                <li>Copy, modify, or distribute our content without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">AI-Generated Content</h2>
              <p>
                StudyBuddy uses artificial intelligence to generate study plans and recommendations. While we strive for
                accuracy, AI-generated content may contain errors. You should:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Review all AI recommendations before following them</li>
                <li>Use your own judgment when applying study strategies</li>
                <li>Verify important information with reliable sources</li>
                <li>Not rely solely on AI-generated content for critical decisions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Intellectual Property</h2>
              <p>
                All content, features, and functionality of StudyBuddy are owned by us and protected by copyright,
                trademark, and other intellectual property laws. You retain ownership of your study data and content
                you create within the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Service Availability</h2>
              <p>
                We strive to keep StudyBuddy available 24/7, but we do not guarantee uninterrupted access. The service
                may be temporarily unavailable due to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Scheduled maintenance and updates</li>
                <li>Technical issues or emergencies</li>
                <li>Factors beyond our control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
              <p>
                StudyBuddy is provided on an as-is basis. We are not responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Academic outcomes or exam results</li>
                <li>Decisions made based on AI recommendations</li>
                <li>Loss of data due to technical issues</li>
                <li>Damages resulting from service interruptions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Account Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account if you:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Violate these Terms and Conditions</li>
                <li>Engage in fraudulent or illegal activities</li>
                <li>Abuse the service or other users</li>
                <li>Remain inactive for an extended period</li>
              </ul>
              <p className="mt-3">
                You may delete your account at any time through the settings page. Upon deletion, your personal data
                will be removed in accordance with our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Changes to Terms</h2>
              <p>
                We may modify these Terms and Conditions at any time. Significant changes will be communicated through
                the platform or via email. Continued use of StudyBuddy after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Governing Law</h2>
              <p>
                These Terms and Conditions are governed by and construed in accordance with applicable laws.
                Any disputes will be resolved through good faith negotiation or appropriate legal channels.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact</h2>
              <p>
                If you have questions about these Terms and Conditions, please contact us at <a href="mailto:studybuddy5512@gmail.com" className="text-primary hover:underline">studybuddy5512@gmail.com</a>.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t">
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </div>
        </main>
      </div>
    </UnifiedPageWrapper>
  );
}
