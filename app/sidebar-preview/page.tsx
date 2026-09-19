'use client';
// TEMPORARY verification harness for the sidebar work. Delete before commit.
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import Layout from '@/components/Layout';

export default function Page() {
  const [, setUser] = useAtom(userAtom);
  useEffect(() => {
    setUser({
      id: 'preview',
      email: 'preview@example.com',
      name: 'Preview User',
      username: 'preview',
      examGoal: 'UPSC',
      examDate: '2027-01-01',
      totalPoints: 1234,
      totalStudyMinutes: 500,
      streak: 3,
      onboardingDone: true,
    });
  }, [setUser]);

  return (
    <Layout>
      <div style={{ height: 400 }}>
        <h2>Sidebar preview content</h2>
      </div>
    </Layout>
  );
}
