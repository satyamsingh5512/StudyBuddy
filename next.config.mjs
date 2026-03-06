/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true, // Ignore types during migration
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
