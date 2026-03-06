'use client';
import Auth from '@/views/Auth';

import GuestGuard from '@/components/GuestGuard';

export default function Page() {
  return (
    <GuestGuard>
      <Auth />
    </GuestGuard>
  );
}
