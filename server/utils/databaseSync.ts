import { PrismaClient } from '@prisma/client';
import { MongoClient, Db } from 'mongodb';

const prisma = new PrismaClient();
let mongoDb: Db | null = null;
let mongoClient: MongoClient | null = null;

// Initialize MongoDB connection
export async function initMongoDB() {
  const MONGODB_URL = process.env.MONGODB_BACKUP_URL;
  
  if (!MONGODB_URL) {
    console.log('⚠️  MongoDB backup not configured (MONGODB_BACKUP_URL not set)');
    return false;
  }

  try {
    console.log('🔄 Connecting to MongoDB backup...');
    mongoClient = new MongoClient(MONGODB_URL);
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    console.log('✅ MongoDB backup connected');
    return true;
  } catch (error) {
    console.error('❌ MongoDB backup connection failed:', error);
    return false;
  }
}

// Close MongoDB connection
export async function closeMongoDB() {
  if (mongoClient) {
    await mongoClient.close();
    mongoDb = null;
    mongoClient = null;
  }
}

// Sync a single record to MongoDB
export async function syncToMongo(collection: string, data: any) {
  if (!mongoDb) return;

  try {
    const { id, ...rest } = data;
    await mongoDb.collection(collection).updateOne(
      { _originalId: id },
      { 
        $set: { 
          ...rest, 
          _originalId: id,
          _syncedAt: new Date(),
          _source: 'cockroachdb'
        } 
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Failed to sync ${collection} to MongoDB:`, error);
  }
}

// Sync multiple records to MongoDB
export async function syncBulkToMongo(collection: string, dataArray: any[]) {
  if (!mongoDb || !dataArray.length) return;

  try {
    const operations = dataArray.map(data => {
      const { id, ...rest } = data;
      return {
        updateOne: {
          filter: { _originalId: id },
          update: { 
            $set: { 
              ...rest, 
              _originalId: id,
              _syncedAt: new Date(),
              _source: 'cockroachdb'
            } 
          },
          upsert: true
        }
      };
    });

    await mongoDb.collection(collection).bulkWrite(operations);
    console.log(`✅ Synced ${dataArray.length} records to MongoDB ${collection}`);
  } catch (error) {
    console.error(`Failed to bulk sync ${collection} to MongoDB:`, error);
  }
}

// Delete from MongoDB
export async function deleteFromMongo(collection: string, id: string) {
  if (!mongoDb) return;

  try {
    await mongoDb.collection(collection).deleteOne({ _originalId: id });
  } catch (error) {
    console.error(`Failed to delete from MongoDB ${collection}:`, error);
  }
}

// Full database backup to MongoDB
export async function fullBackupToMongo() {
  if (!mongoDb) {
    console.log('⚠️  MongoDB not connected, skipping backup');
    return;
  }

  console.log('🔄 Starting full database backup to MongoDB...');

  try {
    // Backup Users
    const users = await prisma.user.findMany();
    await syncBulkToMongo('users', users);

    // Backup Schools
    const schools = await prisma.school.findMany();
    await syncBulkToMongo('schools', schools);

    // Backup Colleges
    const colleges = await prisma.college.findMany();
    await syncBulkToMongo('colleges', colleges);

    // Backup Coachings
    const coachings = await prisma.coaching.findMany();
    await syncBulkToMongo('coachings', coachings);

    // Backup Todos
    const todos = await prisma.todo.findMany();
    await syncBulkToMongo('todos', todos);

    // Backup DailyReports
    const reports = await prisma.dailyReport.findMany();
    await syncBulkToMongo('dailyReports', reports);

    // Backup TimerSessions
    const sessions = await prisma.timerSession.findMany();
    await syncBulkToMongo('timerSessions', sessions);

    // Backup Schedules
    const schedules = await prisma.schedule.findMany();
    await syncBulkToMongo('schedules', schedules);

    // Backup Messages
    const chatMessages = await prisma.chatMessage.findMany();
    await syncBulkToMongo('chatMessages', chatMessages);

    const schoolMessages = await prisma.schoolMessage.findMany();
    await syncBulkToMongo('schoolMessages', schoolMessages);

    const collegeMessages = await prisma.collegeMessage.findMany();
    await syncBulkToMongo('collegeMessages', collegeMessages);

    const coachingMessages = await prisma.coachingMessage.findMany();
    await syncBulkToMongo('coachingMessages', coachingMessages);

    // Backup Friendships
    const friendships = await prisma.friendship.findMany();
    await syncBulkToMongo('friendships', friendships);

    const directMessages = await prisma.directMessage.findMany();
    await syncBulkToMongo('directMessages', directMessages);

    const blocks = await prisma.block.findMany();
    await syncBulkToMongo('blocks', blocks);

    // Backup FAQs and Notices
    const faqs = await prisma.fAQ.findMany();
    await syncBulkToMongo('faqs', faqs);

    const notices = await prisma.notice.findMany();
    await syncBulkToMongo('notices', notices);

    // Backup Forms System
    const forms = await prisma.form.findMany();
    await syncBulkToMongo('forms', forms);

    const formSections = await prisma.formSection.findMany();
    await syncBulkToMongo('formSections', formSections);

    const formFields = await prisma.formField.findMany();
    await syncBulkToMongo('formFields', formFields);

    const formResponses = await prisma.formResponse.findMany();
    await syncBulkToMongo('formResponses', formResponses);

    const formAnswers = await prisma.formAnswer.findMany();
    await syncBulkToMongo('formAnswers', formAnswers);

    const formCollaborators = await prisma.formCollaborator.findMany();
    await syncBulkToMongo('formCollaborators', formCollaborators);

    const webhookLogs = await prisma.webhookLog.findMany();
    await syncBulkToMongo('webhookLogs', webhookLogs);

    const formActivityLogs = await prisma.formActivityLog.findMany();
    await syncBulkToMongo('formActivityLogs', formActivityLogs);

    console.log('✅ Full database backup to MongoDB completed!');
    
    // Store backup metadata
    await mongoDb.collection('_backupMetadata').insertOne({
      timestamp: new Date(),
      source: 'cockroachdb',
      status: 'completed',
      collections: [
        'users', 'schools', 'colleges', 'coachings', 'todos', 'dailyReports',
        'timerSessions', 'schedules', 'chatMessages', 'schoolMessages',
        'collegeMessages', 'coachingMessages', 'friendships', 'directMessages',
        'blocks', 'faqs', 'notices', 'forms', 'formSections', 'formFields',
        'formResponses', 'formAnswers', 'formCollaborators', 'webhookLogs',
        'formActivityLogs'
      ]
    });

    return true;
  } catch (error) {
    console.error('❌ Full backup failed:', error);
    return false;
  }
}

// Restore from MongoDB to CockroachDB (or any SQL DB)
export async function restoreFromMongo() {
  if (!mongoDb) {
    console.log('⚠️  MongoDB not connected, cannot restore');
    return false;
  }

  console.log('🔄 Starting database restore from MongoDB...');

  try {
    // Note: This is a simplified restore. In production, you'd want to:
    // 1. Handle foreign key dependencies (restore in correct order)
    // 2. Map MongoDB _originalId back to SQL id
    // 3. Handle data type conversions
    
    console.log('⚠️  Restore functionality requires careful implementation');
    console.log('   Use the export/import scripts for full migration');
    
    return false;
  } catch (error) {
    console.error('❌ Restore failed:', error);
    return false;
  }
}

// Schedule automatic backups
export function scheduleBackups(intervalHours: number = 24) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  console.log(`📅 Scheduling automatic backups every ${intervalHours} hours`);
  
  // Initial backup
  setTimeout(() => fullBackupToMongo(), 60000); // 1 minute after startup
  
  // Recurring backups
  setInterval(() => {
    console.log('⏰ Running scheduled backup...');
    fullBackupToMongo();
  }, intervalMs);
}

// Export MongoDB data to JSON (for migration to any DB)
export async function exportMongoToJSON(outputPath: string = './mongodb-backup.json') {
  if (!mongoDb) {
    console.log('⚠️  MongoDB not connected');
    return false;
  }

  try {
    const collections = await mongoDb.listCollections().toArray();
    const backup: any = {};

    for (const collInfo of collections) {
      const collName = collInfo.name;
      if (collName.startsWith('_')) continue; // Skip metadata collections
      
      const data = await mongoDb.collection(collName).find({}).toArray();
      backup[collName] = data;
    }

    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
    console.log(`✅ MongoDB backup exported to ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ Export failed:', error);
    return false;
  }
}
