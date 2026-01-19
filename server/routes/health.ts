/**
 * Health Check Endpoints
 * 
 * Monitor system health and sync status
 */

import { Router } from 'express';
import { getOutboxStats } from '../lib/outbox';
import { checkMongoHealth } from '../lib/mongodb';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/sync
 * Detailed sync status
 */
router.get('/sync', async (req, res) => {
  try {
    const [outboxStats, mongoHealthy, cockroachHealthy] = await Promise.all([
      getOutboxStats(),
      checkMongoHealth(),
      checkCockroachHealth(),
    ]);

    const status = 
      outboxStats.syncLagSeconds < 30 && mongoHealthy && cockroachHealthy
        ? 'healthy'
        : outboxStats.syncLagSeconds < 60
        ? 'degraded'
        : 'unhealthy';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      databases: {
        cockroachdb: cockroachHealthy ? 'connected' : 'disconnected',
        mongodb: mongoHealthy ? 'connected' : 'disconnected',
      },
      sync: {
        queueSize: outboxStats.unprocessed,
        failedEvents: outboxStats.failed,
        syncLagSeconds: outboxStats.syncLagSeconds,
        syncLagMs: outboxStats.syncLagMs,
      },
      alerts: getAlerts(outboxStats),
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
    });
  }
});

/**
 * GET /health/databases
 * Database connection status
 */
router.get('/databases', async (req, res) => {
  const [mongoHealthy, cockroachHealthy] = await Promise.all([
    checkMongoHealth(),
    checkCockroachHealth(),
  ]);

  res.json({
    cockroachdb: {
      status: cockroachHealthy ? 'connected' : 'disconnected',
      type: 'primary',
      role: 'source of truth',
    },
    mongodb: {
      status: mongoHealthy ? 'connected' : 'disconnected',
      type: 'secondary',
      role: 'analytics & search',
    },
  });
});

/**
 * Check CockroachDB health
 */
async function checkCockroachHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate alerts based on metrics
 */
function getAlerts(stats: any): string[] {
  const alerts: string[] = [];

  if (stats.syncLagSeconds > 60) {
    alerts.push('CRITICAL: Sync lag > 60 seconds');
  } else if (stats.syncLagSeconds > 30) {
    alerts.push('WARNING: Sync lag > 30 seconds');
  }

  if (stats.unprocessed > 10000) {
    alerts.push('CRITICAL: Queue size > 10,000 events');
  } else if (stats.unprocessed > 1000) {
    alerts.push('WARNING: Queue size > 1,000 events');
  }

  if (stats.failed > 100) {
    alerts.push('CRITICAL: > 100 failed events');
  } else if (stats.failed > 10) {
    alerts.push('WARNING: > 10 failed events');
  }

  return alerts;
}

export default router;
