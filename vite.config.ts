import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Optimize build performance
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    outDir: 'dist', // Capacitor uses dist folder
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching and performance
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-switch',
            '@radix-ui/react-toast',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-avatar',
            '@radix-ui/react-popover',
          ],
          'utils-vendor': [
            'jotai',
            'clsx',
            'class-variance-authority',
            'date-fns',
            'tailwind-merge',
          ],
          'icons-vendor': ['lucide-react'],
          'framer-vendor': ['framer-motion'],
          'query-vendor': ['@tanstack/react-query'],
          'state-vendor': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'ai-vendor': ['groq-sdk'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'jotai',
      'lucide-react',
      'clsx',
      'date-fns',
      'framer-motion',
      '@tanstack/react-query',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
