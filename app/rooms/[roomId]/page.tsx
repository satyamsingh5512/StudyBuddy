'use client';
import { useParams } from 'next/navigation';
import StudyRoom from '@/views/StudyRoom';

import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === 'string' ? params.roomId : '';

  return (
    <AuthGuard>
      <Layout>
        <StudyRoom roomId={roomId} />
      </Layout>
    </AuthGuard>
  );
}
