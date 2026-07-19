import type { Metadata } from 'next';
import Landing from '@/views/Landing';
import GuestGuard from '@/components/GuestGuard';

export const metadata: Metadata = {
  title: 'StudyBuddy - AI-Powered Study Planner for Competitive Exams',
  description:
    'Turn your exam goal into a daily study plan. AI-guided scheduling, focused study timers, progress analytics, and accountability with friends — built for NEET, JEE, UPSC, and other competitive exam prep.',
  keywords: [
    'study planner',
    'AI study assistant',
    'NEET preparation',
    'JEE preparation',
    'UPSC preparation',
    'study schedule app',
    'exam preparation app',
    'pomodoro study timer',
    'study tracker',
  ],
  alternates: {
    canonical: 'https://sbd.satym.in',
  },
  openGraph: {
    title: 'StudyBuddy - AI-Powered Study Planner for Competitive Exams',
    description:
      'Turn your exam goal into a daily study plan with AI-guided scheduling, focused study sessions, and progress you can act on.',
    url: 'https://sbd.satym.in',
    siteName: 'StudyBuddy',
    images: [
      {
        url: '/assets/3d/hero-portal.png',
        width: 1200,
        height: 630,
        alt: 'StudyBuddy study planning dashboard preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StudyBuddy - AI-Powered Study Planner for Competitive Exams',
    description:
      'Turn your exam goal into a daily study plan with AI-guided scheduling, focused study sessions, and progress you can act on.',
    images: ['/assets/3d/hero-portal.png'],
  },
};

export default function Page() {
  return (
    <GuestGuard>
      <Landing />
    </GuestGuard>
  );
}
