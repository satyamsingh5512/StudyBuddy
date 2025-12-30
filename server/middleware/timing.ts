/**
 * Request Timing Middleware
 * File: server/middleware/timing.ts
 * 
 * Logs request duration, path, method, and status for performance monitoring.
 * 
 * Install: npm install on-finished
 * Usage: app.use(timingMiddleware);
 */

import { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';

interface TimingData {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userId?: string;
}

// In-memory metrics for quick access (replace with Prometheus in production)
const metrics = {
  requestCount: 0,
  totalDuration: 0,
  slowRequests: [] as TimingData[],
  p95Latencies: [] as number[],
};

export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const startTimestamp = new Date().toISOString();

  onFinished(res, () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const timingData: TimingData = {
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      duration: Math.round(durationMs * 100) / 100,
      timestamp: startTimestamp,
      userId: (req.user as any)?.id,
    };

    // Update metrics
    metrics.requestCount++;
    metrics.totalDuration += durationMs;
    metrics.p95Latencies.push(durationMs);

    // Keep only last 1000 latencies for p95 calculation
    if (metrics.p95Latencies.length > 1000) {
      metrics.p95Latencies.shift();
    }

    // Log slow requests (>500ms)
    if (durationMs > 500) {
      metrics.slowRequests.push(timingData);
      if (metrics.slowRequests.length > 100) {
        metrics.slowRequests.shift();
      }
      console.warn(`[SLOW] ${timingData.method} ${timingData.path} - ${timingData.duration}ms`);
    }

    // Standard logging (JSON format for easy parsing)
    if (process.env.NODE_ENV === 'development' || durationMs > 200) {
      console.log(JSON.stringify({
        type: 'request',
        ...timingData,
      }));
    }
  });

  next();
};

// Endpoint to get current metrics
export const getMetrics = () => {
  const sorted = [...metrics.p95Latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p50Index = Math.floor(sorted.length * 0.5);

  return {
    requestCount: metrics.requestCount,
    avgLatency: metrics.requestCount > 0 
      ? Math.round(metrics.totalDuration / metrics.requestCount * 100) / 100 
      : 0,
    p50Latency: sorted[p50Index] || 0,
    p95Latency: sorted[p95Index] || 0,
    slowRequests: metrics.slowRequests.slice(-10),
  };
};

// Reset metrics (useful for testing)
export const resetMetrics = () => {
  metrics.requestCount = 0;
  metrics.totalDuration = 0;
  metrics.slowRequests = [];
  metrics.p95Latencies = [];
};

export default timingMiddleware;
