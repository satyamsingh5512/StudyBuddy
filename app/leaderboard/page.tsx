'use client';
import Leaderboard from '@/views/Leaderboard';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <Leaderboard />
      </Layout>
    </AuthGuard>
  );
}
