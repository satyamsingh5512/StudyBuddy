'use client';
import StudyRooms from '@/views/StudyRooms';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <Layout>
        <StudyRooms />
      </Layout>
    </AuthGuard>
  );
}
