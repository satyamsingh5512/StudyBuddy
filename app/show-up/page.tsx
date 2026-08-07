'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import ShowUp from '@/views/ShowUp';

export default function Page() {
  return <AuthGuard><Layout><ShowUp /></Layout></AuthGuard>;
}
