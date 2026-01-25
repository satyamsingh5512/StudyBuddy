/**
 * Metrics Middleware
 * File: server/middleware/metrics.ts
 * 
 * Middleware for collecting and exposing application metrics
 */

import { Request, Response, NextFunction } from 'express';

interface Metrics {
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
    byPath: Record<string, number>;
  };
  responseTime: {
    total: number;
    count: number;
    average: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
}

const metrics: Metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byPath: {},
  },
  responseTime: {
    total: 0,
    count: 0,
    average: 0,
  },
  errors: {
    total: 0,
    byType: {},
  },
};

/**
 * Middleware to collect request metrics
 */
export function metricsCollector(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Increment request counters
  metrics.requests.total++;
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
  metrics.requests.byPath[req.path] = (metrics.requests.byPath[req.path] || 0) + 1;

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Update response time metrics
    metrics.responseTime.total += duration;
    metrics.responseTime.count++;
    metrics.responseTime.average = metrics.responseTime.total / metrics.responseTime.count;

    // Update status code metrics
    metrics.requests.byStatus[res.statusCode] = (metrics.requests.byStatus[res.statusCode] || 0) + 1;

    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors.total++;
      const errorType = res.statusCode >= 500 ? '5xx' : '4xx';
      metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
    }
  });

  next();
}

/**
 * Get current metrics
 */
export function getMetrics(): Metrics {
  return { ...metrics };
}

/**
 * Reset metrics
 */
export function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.byMethod = {};
  metrics.requests.byStatus = {};
  metrics.requests.byPath = {};
  metrics.responseTime.total = 0;
  metrics.responseTime.count = 0;
  metrics.responseTime.average = 0;
  metrics.errors.total = 0;
  metrics.errors.byType = {};
}

/**
 * Endpoint to expose metrics
 */
export function metricsEndpoint(req: Request, res: Response) {
  res.json(getMetrics());
}

export default { metricsCollector, getMetrics, resetMetrics, metricsEndpoint };
