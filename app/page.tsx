'use client';
import Landing from '@/views/Landing';
import GuestGuard from '@/components/GuestGuard';

export default function Page() {
  return (
    <GuestGuard>
      <Landing />
    </GuestGuard>
  );
}
