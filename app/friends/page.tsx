'use client';
import Friends from '@/views/Friends';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Friends />
      </Layout>
    </AuthGuard>
  );
}
