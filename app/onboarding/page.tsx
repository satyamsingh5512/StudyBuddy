'use client';
import Onboarding from '@/views/Onboarding';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard requireOnboarding={false}>
      <Onboarding />
    </AuthGuard>
  );
}
