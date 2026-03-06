'use client';
import Schedule from '@/views/Schedule';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Schedule />
      </Layout>
    </AuthGuard>
  );
}
