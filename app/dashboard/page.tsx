'use client';
import Dashboard from '@/views/Dashboard';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Dashboard />
      </Layout>
    </AuthGuard>
  );
}
