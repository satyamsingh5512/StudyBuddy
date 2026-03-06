'use client';
import ResetPassword from '@/views/ResetPassword';

import GuestGuard from '@/components/GuestGuard';

export default function Page() {
  return (
    <GuestGuard>
      <ResetPassword />
    </GuestGuard>
  );
}
