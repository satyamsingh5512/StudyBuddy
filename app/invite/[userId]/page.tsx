'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import Invite from '@/views/Invite';

export default function InvitePage() {
  return (
    <AuthGuard>
      <Layout>
        <Invite />
      </Layout>
    </AuthGuard>
  );
}
