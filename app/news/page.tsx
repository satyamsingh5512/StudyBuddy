'use client';
import News from '@/views/News';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <News />
      </Layout>
    </AuthGuard>
  );
}
