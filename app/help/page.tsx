'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Help from '@/views/Help';

export default function Page() {
  return <AuthGuard><Layout><Help /></Layout></AuthGuard>;
}
