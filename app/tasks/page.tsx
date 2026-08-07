'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Tasks from '@/views/Tasks';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Tasks />
      </Layout>
    </AuthGuard>
  );
}
