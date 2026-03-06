'use client';
import Messages from '@/views/Messages';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Messages />
      </Layout>
    </AuthGuard>
  );
}
