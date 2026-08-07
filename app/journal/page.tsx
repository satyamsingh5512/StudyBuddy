'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Journal from '@/views/Journal';

export default function Page() {
  return <AuthGuard><Layout><Journal /></Layout></AuthGuard>;
}
