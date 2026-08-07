'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Mentor from '@/views/Mentor';

export default function Page() {
  return <AuthGuard><Layout><Mentor /></Layout></AuthGuard>;
}
