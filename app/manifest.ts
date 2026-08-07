import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyBuddy',
    short_name: 'StudyBuddy',
    description: 'AI-powered study planning, focus, goals, and progress tracking.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f5f5',
    theme_color: '#1d4dff',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
