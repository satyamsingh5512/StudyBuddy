'use client';

import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import FocusTools from '@/views/FocusTools';

export default function FocusToolsPage() {
  return (
    <AuthGuard>
      <Layout>
        <FocusTools />
      </Layout>
    </AuthGuard>
  );
}
