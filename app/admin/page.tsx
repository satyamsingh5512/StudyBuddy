'use client';
import Admin from '@/views/Admin';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Admin />
      </Layout>
    </AuthGuard>
  );
}
