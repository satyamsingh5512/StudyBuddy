'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Achievements from '@/views/Achievements';

export default function Page() {
  return <AuthGuard><Layout><Achievements /></Layout></AuthGuard>;
}
