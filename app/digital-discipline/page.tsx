'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import DigitalDiscipline from '@/views/DigitalDiscipline';

export default function DigitalDisciplinePage() {
  return (
    <AuthGuard>
      <Layout>
        <DigitalDiscipline />
      </Layout>
    </AuthGuard>
  );
}
