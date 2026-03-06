'use client';
import Notices from '@/views/Notices';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Notices />
      </Layout>
    </AuthGuard>
  );
}
