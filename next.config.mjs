import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const fallbackBackendApiUrl = 'https://studybuddy-go-backend.onrender.com/api';

const normalizeBackendApiUrl = (value) => {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.startsWith('/')) return null;

  const absolute = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return absolute.endsWith('/api') ? absolute : `${absolute}/api`;
};

// BACKEND_API_URL is server-only. NEXT_PUBLIC_API_URL remains a compatibility
// fallback for existing deployments, but it is never used by browser code.
const backendApiUrl =
  normalizeBackendApiUrl(process.env.BACKEND_API_URL) ||
  normalizeBackendApiUrl(process.env.NEXT_PUBLIC_API_URL) ||
  fallbackBackendApiUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Tree-shake large libraries to smaller per-icon/per-util imports.
  // Reduces client bundle size with no behavior change.
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns'],
  },
};

export default nextConfig;
