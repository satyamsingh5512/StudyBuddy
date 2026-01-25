import { db } from './db';

// Re-export db as prisma for compatibility during migration
export const prisma = db;
