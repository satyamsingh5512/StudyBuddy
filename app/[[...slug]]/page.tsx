'use client';
import dynamic from 'next/dynamic';

const ClientApp = dynamic(() => import('./client'), { ssr: false });

export default function Page() {
  return <ClientApp />;
}
