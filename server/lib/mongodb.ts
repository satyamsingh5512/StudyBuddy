/**
 * MongoDB Connection Singleton
 * 
 * OPTIMIZATION: Single connection pool reused across all requests
 * BEFORE: New connection on every sync = slow + memory leak
 * AFTER: Singleton pattern = fast + efficient
 */

import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let isConnecting = false;

/**
 * Get MongoDB database instance
 * Creates connection on first call, reuses thereafter
 */
export async function getMongoDb(): Promise<Db | null> {
  // Return existing connection
  if (mongoDb) {
    return mongoDb;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for connection to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return getMongoDb();
  }

  const MONGODB_URL = process.env.MONGODB_BACKUP_URL;

  if (!MONGODB_URL) {
    console.log('⚠️  MongoDB not configured (MONGODB_BACKUP_URL not set)');
    return null;
  }

  try {
    isConnecting = true;
    console.log('🔄 Connecting to MongoDB...');
    
    mongoClient = new MongoClient(MONGODB_URL, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db();
    
    console.log('✅ MongoDB connected');
    
    // Create indexes for fast queries
    await createMongoIndexes(mongoDb);
    
    return mongoDb;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Close MongoDB connection
 * Called on server shutdown
 */
export async function closeMongoDb() {
  if (mongoClient) {
    await mongoClient.close();
    mongoDb = null;
    mongoClient = null;
    console.log('✅ MongoDB connection closed');
  }
}

/**
 * Create MongoDB indexes for fast queries
 * Run once on connection
 */
async function createMongoIndexes(db: Db) {
  try {
    // Users collection
    await db.collection('users').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 });
    await db.collection('users').createIndex({ totalPoints: -1 });
    await db.collection('users').createIndex({ _syncedAt: -1 });

    // Todos collection
    await db.collection('todos').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('todos').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('todos').createIndex({ userId: 1, completed: 1 });

    // Messages collections
    await db.collection('directMessages').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('directMessages').createIndex({ senderId: 1, receiverId: 1, createdAt: -1 });
    await db.collection('directMessages').createIndex({ receiverId: 1, read: 1 });

    // Reports collection
    await db.collection('dailyReports').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('dailyReports').createIndex({ userId: 1, date: -1 });

    // Timer sessions
    await db.collection('timerSessions').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('timerSessions').createIndex({ userId: 1, completedAt: -1 });

    // Forms
    await db.collection('forms').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('forms').createIndex({ ownerId: 1 });
    await db.collection('forms').createIndex({ customSlug: 1 });

    // Form responses
    await db.collection('formResponses').createIndex({ _originalId: 1 }, { unique: true });
    await db.collection('formResponses').createIndex({ formId: 1, submittedAt: -1 });

    console.log('✅ MongoDB indexes created');
  } catch (error) {
    console.error('⚠️  MongoDB index creation failed:', error);
    // Don't throw - indexes are optimization, not critical
  }
}

/**
 * Upsert document to MongoDB
 * Idempotent operation - safe to retry
 * 
 * @param collection - Collection name
 * @param originalId - CockroachDB ID
 * @param data - Document data
 */
export async function upsertToMongo(
  collection: string,
  originalId: string,
  data: any
) {
  const db = await getMongoDb();
  if (!db) return false;

  try {
    const { id, ...rest } = data;
    
    await db.collection(collection).updateOne(
      { _originalId: originalId },
      {
        $set: {
          ...rest,
          _originalId: originalId,
          _syncedAt: new Date(),
          _source: 'cockroachdb',
        },
      },
      { upsert: true }
    );

    return true;
  } catch (error) {
    console.error(`Failed to upsert to MongoDB ${collection}:`, error);
    return false;
  }
}

/**
 * Delete document from MongoDB
 * Idempotent operation - safe to retry
 */
export async function deleteFromMongo(
  collection: string,
  originalId: string
) {
  const db = await getMongoDb();
  if (!db) return false;

  try {
    await db.collection(collection).deleteOne({ _originalId: originalId });
    return true;
  } catch (error) {
    console.error(`Failed to delete from MongoDB ${collection}:`, error);
    return false;
  }
}

/**
 * Query MongoDB for analytics
 * Fast read-only queries
 */
export async function queryMongo<T = any>(
  collection: string,
  filter: any = {},
  options: any = {}
): Promise<T[]> {
  const db = await getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection(collection)
      .find(filter, options)
      .toArray() as T[];
  } catch (error) {
    console.error(`Failed to query MongoDB ${collection}:`, error);
    return [];
  }
}

/**
 * Aggregate query for analytics
 */
export async function aggregateMongo<T = any>(
  collection: string,
  pipeline: any[]
): Promise<T[]> {
  const db = await getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection(collection)
      .aggregate(pipeline)
      .toArray() as T[];
  } catch (error) {
    console.error(`Failed to aggregate MongoDB ${collection}:`, error);
    return [];
  }
}

/**
 * Health check for MongoDB
 */
export async function checkMongoHealth(): Promise<boolean> {
  try {
    const db = await getMongoDb();
    if (!db) return false;

    await db.admin().ping();
    return true;
  } catch (error) {
    return false;
  }
}
