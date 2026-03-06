'use client';
import Reports from '@/views/Reports';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Reports />
      </Layout>
    </AuthGuard>
  );
}
