import { syncToMongo, deleteFromMongo } from '../utils/databaseSync';

// Middleware to sync database operations to MongoDB
export function createSyncMiddleware(collection: string) {
  return {
    // Sync after create
    afterCreate: async (data: any) => {
      await syncToMongo(collection, data);
    },

    // Sync after update
    afterUpdate: async (data: any) => {
      await syncToMongo(collection, data);
    },

    // Sync after delete
    afterDelete: async (id: string) => {
      await deleteFromMongo(collection, id);
    }
  };
}

// Helper to wrap Prisma operations with MongoDB sync
export function withMongoSync<T>(
  operation: () => Promise<T>,
  collection: string,
  action: 'create' | 'update' | 'delete',
  getId?: (result: T) => string
): Promise<T> {
  return operation().then(async (result) => {
    try {
      if (action === 'delete' && getId) {
        await deleteFromMongo(collection, getId(result));
      } else if (action === 'create' || action === 'update') {
        await syncToMongo(collection, result);
      }
    } catch (error) {
      console.error(`MongoDB sync failed for ${collection}:`, error);
      // Don't throw - backup failure shouldn't break the app
    }
    return result;
  });
}
