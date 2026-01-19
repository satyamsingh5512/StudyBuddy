/**
 * Background Sync Worker
 * 
 * RESPONSIBILITY: Sync outbox events to MongoDB
 * 
 * GUARANTEES:
 * - Zero data loss (events persist in outbox)
 * - Idempotent (safe to retry)
 * - Ordered processing (FIFO)
 * - Exponential backoff on failure
 * 
 * USAGE:
 * - Run as separate process: node dist/workers/syncWorker.js
 * - Or: npm run worker:sync
 */

import { 
  fetchUnprocessedEvents,
  markEventProcessed,
  markEventFailed,
  getOutboxStats,
  cleanupProcessedEvents,
  EventType,
  AggregateType
} from '../lib/outbox';
import { upsertToMongo, deleteFromMongo, getMongoDb } from '../lib/mongodb';

// Configuration
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const BATCH_SIZE = 100; // Process 100 events per batch
const MAX_RETRIES = 10; // Give up after 10 failures
const CLEANUP_INTERVAL_HOURS = 24; // Clean old events daily

// Metrics
let totalProcessed = 0;
let totalFailed = 0;
let isRunning = false;

/**
 * Map event type to MongoDB collection name
 */
function getCollectionName(aggregateType: AggregateType): string {
  const mapping: Record<AggregateType, string> = {
    user: 'users',
    todo: 'todos',
    message: 'directMessages',
    report: 'dailyReports',
    session: 'timerSessions',
    friendship: 'friendships',
    form: 'forms',
    response: 'formResponses',
  };

  return mapping[aggregateType] || aggregateType;
}

/**
 * Process a single outbox event
 * Idempotent - safe to call multiple times
 */
async function processEvent(event: any): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    const collection = getCollectionName(event.aggregateType);
    const eventType = event.eventType as EventType;

    // Determine operation type
    if (eventType.endsWith('.deleted')) {
      // DELETE operation
      const success = await deleteFromMongo(collection, event.aggregateId);
      
      if (!success) {
        throw new Error('Delete operation failed');
      }

      console.log(`✅ Deleted ${collection}/${event.aggregateId} (${Date.now() - startTime}ms)`);
    } else {
      // CREATE or UPDATE operation (both use upsert)
      const success = await upsertToMongo(
        collection,
        event.aggregateId,
        event.payload
      );

      if (!success) {
        throw new Error('Upsert operation failed');
      }

      console.log(`✅ Synced ${collection}/${event.aggregateId} (${Date.now() - startTime}ms)`);
    }

    // Mark as processed
    await markEventProcessed(event.id);
    totalProcessed++;
    
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to process event ${event.id}:`, error.message);
    
    // Mark as failed with error message
    await markEventFailed(event.id, error.message);
    totalFailed++;
    
    return false;
  }
}

/**
 * Process a batch of events
 * Returns number of successfully processed events
 */
async function processBatch(): Promise<number> {
  const events = await fetchUnprocessedEvents(BATCH_SIZE, MAX_RETRIES);

  if (events.length === 0) {
    return 0;
  }

  console.log(`📦 Processing batch of ${events.length} events...`);

  let successCount = 0;

  // Process events sequentially to maintain order
  for (const event of events) {
    const success = await processEvent(event);
    if (success) {
      successCount++;
    }

    // Small delay between events to avoid overwhelming MongoDB
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return successCount;
}

/**
 * Main worker loop
 * Polls outbox and processes events continuously
 */
async function workerLoop() {
  if (isRunning) {
    console.log('⚠️  Worker already running');
    return;
  }

  isRunning = true;
  console.log('🚀 Sync worker started');
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Max retries: ${MAX_RETRIES}`);

  // Ensure MongoDB is connected
  const db = await getMongoDb();
  if (!db) {
    console.error('❌ MongoDB not available, worker cannot start');
    isRunning = false;
    return;
  }

  let consecutiveEmptyPolls = 0;
  let backoffMs = POLL_INTERVAL_MS;

  while (isRunning) {
    try {
      const processed = await processBatch();

      if (processed > 0) {
        // Reset backoff on successful processing
        consecutiveEmptyPolls = 0;
        backoffMs = POLL_INTERVAL_MS;
      } else {
        // Exponential backoff when queue is empty
        consecutiveEmptyPolls++;
        
        if (consecutiveEmptyPolls > 5) {
          backoffMs = Math.min(backoffMs * 1.5, 30000); // Max 30s
        }
      }

      // Log stats every 10 batches
      if (totalProcessed % (BATCH_SIZE * 10) === 0 && totalProcessed > 0) {
        const stats = await getOutboxStats();
        console.log(`📊 Stats: Processed=${totalProcessed}, Failed=${totalFailed}, Queue=${stats.unprocessed}, Lag=${stats.syncLagSeconds}s`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    } catch (error) {
      console.error('❌ Worker loop error:', error);
      
      // Backoff on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('🛑 Sync worker stopped');
}

/**
 * Stop the worker gracefully
 */
function stopWorker() {
  console.log('🛑 Stopping sync worker...');
  isRunning = false;
}

/**
 * Cleanup old processed events
 * Run periodically to prevent table bloat
 */
async function cleanupLoop() {
  while (isRunning) {
    try {
      await cleanupProcessedEvents(7); // Delete events older than 7 days
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }

    // Wait 24 hours
    await new Promise(resolve => setTimeout(resolve, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000));
  }
}

/**
 * Get worker statistics
 */
export function getWorkerStats() {
  return {
    isRunning,
    totalProcessed,
    totalFailed,
    successRate: totalProcessed / (totalProcessed + totalFailed) || 0,
  };
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  stopWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  stopWorker();
  process.exit(0);
});

// Start worker if run directly
if (require.main === module) {
  console.log('🔧 Starting StudyBuddy Sync Worker...');
  
  // Start main worker loop
  workerLoop().catch(error => {
    console.error('❌ Worker crashed:', error);
    process.exit(1);
  });

  // Start cleanup loop
  cleanupLoop().catch(error => {
    console.error('❌ Cleanup loop crashed:', error);
  });
}

export { workerLoop, stopWorker };
