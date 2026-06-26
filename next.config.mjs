/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true, // Ignore types during migration
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Tree-shake large libraries to smaller per-icon/per-util imports.
  // Reduces client bundle size with no behavior change.
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns'],
  },
};

export default nextConfig;
