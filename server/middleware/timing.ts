/**
 * Timing Middleware
 * File: server/middleware/timing.ts
 * 
 * Middleware for measuring request timing and performance
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Add timing information to response headers
 */
export function timingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();

  // Add Server-Timing header on response finish
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    // Add Server-Timing header
    res.setHeader('Server-Timing', `total;dur=${duration.toFixed(2)}`);
  });

  next();
}

/**
 * Log slow requests
 */
export function slowRequestLogger(threshold: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        console.warn(`⚠️  Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  };
}

/**
 * Request timing with detailed breakdown
 */
export function detailedTiming(req: Request, res: Response, next: NextFunction) {
  const timings: Record<string, number> = {};
  const startTime = process.hrtime.bigint();

  // Store timing function on request
  (req as any).timing = {
    mark: (label: string) => {
      const now = process.hrtime.bigint();
      timings[label] = Number(now - startTime) / 1_000_000;
    },
    getTimings: () => timings,
  };

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000;

    // Build Server-Timing header
    const timingEntries = Object.entries(timings)
      .map(([label, duration]) => `${label};dur=${duration.toFixed(2)}`)
      .join(', ');

    const serverTiming = timingEntries
      ? `${timingEntries}, total;dur=${totalDuration.toFixed(2)}`
      : `total;dur=${totalDuration.toFixed(2)}`;

    res.setHeader('Server-Timing', serverTiming);
  });

  next();
}

export default { timingMiddleware, slowRequestLogger, detailedTiming };
