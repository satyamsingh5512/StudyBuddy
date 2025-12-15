#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🔄 Updating database schema for timer sessions...');

try {
  // Generate Prisma client with new schema
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Push schema changes to database
  console.log('🚀 Pushing schema changes to database...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  
  console.log('✅ Database migration completed successfully!');
  console.log('🎉 Timer sessions and analytics are now ready to use.');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}