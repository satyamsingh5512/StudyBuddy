/**
 * Clear all database collections
 * WARNING: This will delete ALL data from the database!
 * Usage: npm run db:clear
 */

import { getMongoDb } from '../server/lib/mongodb';

async function clearDatabase() {
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('⏳ Starting database cleanup...\n');

  try {
    const db = await getMongoDb();
    if (!db) {
      throw new Error('Failed to connect to database');
    }

    // Get all collections
    const collections = await db.listCollections().toArray();

    console.log(`📋 Found ${collections.length} collections\n`);

    let deletedCount = 0;

    for (const collection of collections) {
      const collectionName = collection.name;

      // Skip system collections
      if (collectionName.startsWith('system.')) {
        console.log(`⏭️  Skipping system collection: ${collectionName}`);
        continue;
      }

      try {
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`✅ Cleared ${collectionName}: ${result.deletedCount} documents deleted`);
        deletedCount += result.deletedCount;
      } catch (error: any) {
        console.error(`❌ Error clearing ${collectionName}:`, error.message);
      }
    }

    console.log(`\n✅ Database cleanup complete!`);
    console.log(`📊 Total documents deleted: ${deletedCount}`);
    console.log(`📦 Collections cleared: ${collections.length}`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  }
}

clearDatabase();
