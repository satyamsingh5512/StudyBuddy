'use client';
import Settings from '@/views/Settings';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Settings />
      </Layout>
    </AuthGuard>
  );
}
