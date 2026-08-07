'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Goals from '@/views/Goals';

export default function Page() {
  return <AuthGuard><Layout><Goals /></Layout></AuthGuard>;
}
