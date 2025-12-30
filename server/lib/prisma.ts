/**
 * Singleton PrismaClient instance
 * File: server/lib/prisma.ts
 * 
 * CRITICAL FIX: Prevents multiple PrismaClient instances which cause:
 * - Connection pool exhaustion
 * - Memory leaks
 * - Slow cold starts
 * 
 * Usage: import prisma from '../lib/prisma';
 */

import { PrismaClient } from '@prisma/client';

// Extend globalThis to include prisma
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Connection pool configuration optimized for Render free tier
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// Use global instance in development to prevent hot-reload issues
// Use singleton in production for optimal connection reuse
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
