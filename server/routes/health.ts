/**
 * Health Check Endpoints
 * 
 * Monitor system health
 */

import { Router } from 'express';
import { checkMongoHealth } from '../lib/mongodb';

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
 * GET /health/detailed
 * Detailed health status
 */
router.get('/detailed', async (req, res) => {
  try {
    const mongoHealthy = await checkMongoHealth();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: mongoHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime() / 60)} minutes`,
      database: {
        mongodb: mongoHealthy ? 'connected' : 'disconnected',
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      },
      environment: process.env.NODE_ENV || 'development',
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
 * GET /health/database
 * Database connection status
 */
router.get('/database', async (req, res) => {
  const mongoHealthy = await checkMongoHealth();

  res.json({
    mongodb: {
      status: mongoHealthy ? 'connected' : 'disconnected',
      type: 'primary',
      role: 'main database',
    },
  });
});

export default router;
