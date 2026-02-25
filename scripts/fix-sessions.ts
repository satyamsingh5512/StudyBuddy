/**
 * Fix corrupted sessions in MongoDB
 * Run: npx tsx --env-file=.env scripts/fix-sessions.ts
 */
import { getMongoDb } from '../server/lib/mongodb';

async function fixSessions() {
  console.log('🔧 Fixing corrupted sessions...\n');

  try {
    const db = await getMongoDb();
    if (!db) {
      console.error('❌ Failed to connect to MongoDB');
      process.exit(1);
    }

    const sessionsCollection = db.collection('sessions');

    // Remove sessions with null sid
    const result = await sessionsCollection.deleteMany({ sid: null });
    console.log(`✅ Removed ${result.deletedCount} corrupted sessions with null sid`);

    // Remove all sessions (fresh start)
    const allResult = await sessionsCollection.deleteMany({});
    console.log(`✅ Removed ${allResult.deletedCount} total sessions for fresh start`);

    console.log('\n✨ Sessions fixed successfully!');
    console.log('🔄 You can now login without errors.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing sessions:', error);
    process.exit(1);
  }
}

fixSessions();
