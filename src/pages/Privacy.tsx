import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
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
      <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: November 20, 2025</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">Introduction</h2>
            <p>
              Welcome to StudyBuddy. We respect your privacy and are committed to protecting your personal information.
              This Privacy Policy explains how we collect, use, and safeguard your data when you use our study planning platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> When you sign up using Google OAuth, we collect your name, email address, 
                and profile picture from your Google account.
              </li>
              <li>
                <strong>Study Data:</strong> We collect information about your study sessions, tasks, goals, exam dates, 
                and progress to provide personalized recommendations.
              </li>
              <li>
                <strong>Usage Data:</strong> We collect information about how you use StudyBuddy, including features accessed, 
                time spent, and interactions within the platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and improve our AI-powered study planning services</li>
              <li>To personalize your experience and generate custom study recommendations</li>
              <li>To track your progress and help you achieve your academic goals</li>
              <li>To communicate with you about updates, features, and important notifications</li>
              <li>To ensure the security and proper functioning of our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. Your data is stored 
              securely using encrypted connections, and we use secure authentication through Google OAuth. We never store 
              your Google password.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your data only in 
              the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or court orders</li>
              <li>To protect the rights, property, or safety of StudyBuddy, our users, or others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal information</li>
              <li>Update or correct your data</li>
              <li>Delete your account and associated data</li>
              <li>Export your study data</li>
              <li>Opt-out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember your preferences, and analyze 
              platform usage. You can control cookie settings through your browser, but some features may not work properly 
              if cookies are disabled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Children&apos;s Privacy</h2>
            <p>
              StudyBuddy is designed for students of all ages. If you are under 18, please ensure you have parental consent 
              before using our platform. We do not knowingly collect personal information from children under 13 without 
              parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by 
              posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or how we handle your data, please contact us through 
              the support section in your dashboard.
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
  );
}
