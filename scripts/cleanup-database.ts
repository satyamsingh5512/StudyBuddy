/**
 * Database Cleanup Script
 * Deletes all data from MongoDB collections for a fresh start
 * 
 * Usage: npx tsx scripts/cleanup-database.ts
 */

import { getMongoDb, closeMongoDb } from '../server/lib/mongodb';

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    const db = await getMongoDb();
    
    if (!db) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // List of collections to clean
    const collections = [
      'users',
      'sessions',
      'todos',
      'daily_reports',
      'schedules',
      'timer_sessions',
      'notices',
      'faqs',
      'friendships',
      'blocks',
      'direct_messages',
    ];

    console.log('📋 Collections to clean:');
    collections.forEach(col => console.log(`   - ${col}`));
    console.log('');

    // Delete all documents from each collection
    for (const collectionName of collections) {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`✅ ${collectionName.padEnd(25)} - Deleted ${result.deletedCount} documents`);
      } catch (error: any) {
        // Collection might not exist, that's okay
        if (error.code === 26) {
          console.log(`⚠️  ${collectionName.padEnd(25)} - Collection doesn't exist (skipped)`);
        } else {
          console.error(`❌ ${collectionName.padEnd(25)} - Error: ${error.message}`);
        }
      }
    }

    console.log('\n✨ Database cleanup completed successfully!');
    console.log('📊 All user data has been removed.');
    console.log('🔄 You can now start fresh with new signups.\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await closeMongoDb();
  }
}

// Run cleanup
cleanupDatabase();
