'use client';
import Notes from '@/views/Notes';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Notes />
      </Layout>
    </AuthGuard>
  );
}
