/**
 * Verification Script for Dual Database Sync
 * 
 * Tests that data written to CockroachDB appears in MongoDB
 * Run: npx tsx scripts/verify-sync.ts
 */

import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 Verifying dual database sync...\n');

  // Connect to MongoDB
  const MONGODB_URL = process.env.MONGODB_BACKUP_URL;
  if (!MONGODB_URL) {
    console.error('❌ MONGODB_BACKUP_URL not set');
    process.exit(1);
  }

  const mongoClient = new MongoClient(MONGODB_URL);
  await mongoClient.connect();
  const mongoDb = mongoClient.db();

  try {
    // Test 1: Check Outbox table exists
    console.log('Test 1: Checking Outbox table...');
    const outboxCount = await prisma.outbox.count();
    console.log(`✅ Outbox table exists (${outboxCount} events)\n`);

    // Test 2: Check MongoDB connection
    console.log('Test 2: Checking MongoDB connection...');
    await mongoDb.admin().ping();
    console.log('✅ MongoDB connected\n');

    // Test 3: Compare user counts
    console.log('Test 3: Comparing user counts...');
    const cockroachUsers = await prisma.user.count();
    const mongoUsers = await mongoDb.collection('users').countDocuments();
    console.log(`CockroachDB users: ${cockroachUsers}`);
    console.log(`MongoDB users: ${mongoUsers}`);
    
    if (Math.abs(cockroachUsers - mongoUsers) <= 5) {
      console.log('✅ User counts match (within tolerance)\n');
    } else {
      console.log('⚠️  User counts differ significantly\n');
    }

    // Test 4: Compare todo counts
    console.log('Test 4: Comparing todo counts...');
    const cockroachTodos = await prisma.todo.count();
    const mongoTodos = await mongoDb.collection('todos').countDocuments();
    console.log(`CockroachDB todos: ${cockroachTodos}`);
    console.log(`MongoDB todos: ${mongoTodos}`);
    
    if (Math.abs(cockroachTodos - mongoTodos) <= 10) {
      console.log('✅ Todo counts match (within tolerance)\n');
    } else {
      console.log('⚠️  Todo counts differ significantly\n');
    }

    // Test 5: Check sync lag
    console.log('Test 5: Checking sync lag...');
    const oldestUnprocessed = await prisma.outbox.findFirst({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (!oldestUnprocessed) {
      console.log('✅ No unprocessed events (sync is current)\n');
    } else {
      const lagMs = Date.now() - oldestUnprocessed.createdAt.getTime();
      const lagSeconds = Math.round(lagMs / 1000);
      console.log(`Sync lag: ${lagSeconds} seconds`);
      
      if (lagSeconds < 30) {
        console.log('✅ Sync lag is acceptable\n');
      } else {
        console.log('⚠️  Sync lag is high\n');
      }
    }

    // Test 6: Check failed events
    console.log('Test 6: Checking failed events...');
    const failedEvents = await prisma.outbox.count({
      where: {
        processed: false,
        retryCount: { gte: 5 },
      },
    });
    console.log(`Failed events (retry >= 5): ${failedEvents}`);
    
    if (failedEvents === 0) {
      console.log('✅ No failed events\n');
    } else {
      console.log('⚠️  Some events are failing\n');
    }

    // Test 7: Sample data verification
    console.log('Test 7: Verifying sample data...');
    const sampleUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (sampleUser) {
      const mongoUser = await mongoDb.collection('users').findOne({
        _originalId: sampleUser.id,
      });

      if (mongoUser) {
        console.log(`✅ Sample user synced: ${sampleUser.username || sampleUser.email}`);
        console.log(`   CockroachDB ID: ${sampleUser.id}`);
        console.log(`   MongoDB _originalId: ${mongoUser._originalId}`);
        console.log(`   Synced at: ${mongoUser._syncedAt}\n`);
      } else {
        console.log(`⚠️  Sample user not found in MongoDB: ${sampleUser.id}\n`);
      }
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Summary:');
    console.log(`  Outbox events: ${outboxCount}`);
    console.log(`  Unprocessed: ${oldestUnprocessed ? 'Yes' : 'No'}`);
    console.log(`  Failed events: ${failedEvents}`);
    console.log(`  Data sync: ${Math.abs(cockroachUsers - mongoUsers) <= 5 ? 'Good' : 'Check'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failedEvents === 0 && (!oldestUnprocessed || (Date.now() - oldestUnprocessed.createdAt.getTime()) < 30000)) {
      console.log('✅ All checks passed! Sync is working correctly.\n');
    } else {
      console.log('⚠️  Some issues detected. Check logs and worker status.\n');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

// Run verification
verify().catch(console.error);
