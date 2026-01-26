"use strict";
/**
 * Timing Middleware
 * File: server/middleware/timing.ts
 *
 * Middleware for measuring request timing and performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingMiddleware = timingMiddleware;
exports.slowRequestLogger = slowRequestLogger;
exports.detailedTiming = detailedTiming;
/**
 * Add timing information to response headers
 */
function timingMiddleware(req, res, next) {
    const startTime = process.hrtime.bigint();
    // Add Server-Timing header on response finish
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        // Add Server-Timing header
        res.setHeader('Server-Timing', `total;dur=${duration.toFixed(2)}`);
    });
    next();
}
/**
 * Log slow requests
 */
function slowRequestLogger(threshold = 1000) {
    return (req, res, next) => {
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
function detailedTiming(req, res, next) {
    const timings = {};
    const startTime = process.hrtime.bigint();
    // Store timing function on request
    req.timing = {
        mark: (label) => {
            const now = process.hrtime.bigint();
            timings[label] = Number(now - startTime) / 1000000;
        },
        getTimings: () => timings,
    };
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const totalDuration = Number(endTime - startTime) / 1000000;
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
exports.default = { timingMiddleware, slowRequestLogger, detailedTiming };
