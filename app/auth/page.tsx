'use client';
import { AuthComponent } from '@/components/ui/sign-up';
import GuestGuard from '@/components/GuestGuard';
import Logo from '@/components/Logo';

const StudyBuddyLogo = () => (
  <div className="bg-primary text-primary-foreground rounded-md p-1.5 flex items-center justify-center">
    <Logo className="w-4 h-4" noLink />
  </div>
);

export default function Page() {
  return (
    <GuestGuard>
      <AuthComponent
        logo={<StudyBuddyLogo />}
        brandName="StudyBuddy"
      />
    </GuestGuard>
  );
}
