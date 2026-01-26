"use strict";
/**
 * Metrics Middleware
 * File: server/middleware/metrics.ts
 *
 * Middleware for collecting and exposing application metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsCollector = metricsCollector;
exports.getMetrics = getMetrics;
exports.resetMetrics = resetMetrics;
exports.metricsEndpoint = metricsEndpoint;
const metrics = {
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
function metricsCollector(req, res, next) {
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
function getMetrics() {
    return { ...metrics };
}
/**
 * Reset metrics
 */
function resetMetrics() {
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
function metricsEndpoint(req, res) {
    res.json(getMetrics());
}
exports.default = { metricsCollector, getMetrics, resetMetrics, metricsEndpoint };
