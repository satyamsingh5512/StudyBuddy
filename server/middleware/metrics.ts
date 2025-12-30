/**
 * Prometheus-compatible Metrics Middleware
 * File: server/middleware/metrics.ts
 * 
 * Exposes metrics at /metrics endpoint for Prometheus scraping.
 * Lightweight alternative: uses in-memory counters, no external dependencies.
 * 
 * For production with Prometheus:
 * npm install prom-client
 * 
 * Usage: 
 *   app.use(metricsMiddleware);
 *   app.get('/metrics', metricsEndpoint);
 */

import { Request, Response, NextFunction } from 'express';

// Metrics storage
const metrics = {
  http_requests_total: new Map<string, number>(),
  http_request_duration_seconds: [] as { labels: string; value: number }[],
  active_websocket_connections: 0,
  db_query_total: 0,
  db_query_errors: 0,
};

// Histogram buckets for latency (in seconds)
const LATENCY_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const latencyHistogram = new Map<string, Map<number, number>>();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const labels = `method="${req.method}",path="${req.route?.path || req.path}",status="${res.statusCode}"`;

    // Increment request counter
    const currentCount = metrics.http_requests_total.get(labels) || 0;
    metrics.http_requests_total.set(labels, currentCount + 1);

    // Record latency in histogram
    const histKey = `method="${req.method}",path="${req.route?.path || req.path}"`;
    if (!latencyHistogram.has(histKey)) {
      latencyHistogram.set(histKey, new Map());
    }
    const hist = latencyHistogram.get(histKey)!;
    
    for (const bucket of LATENCY_BUCKETS) {
      if (duration <= bucket) {
        hist.set(bucket, (hist.get(bucket) || 0) + 1);
      }
    }
    hist.set(Infinity, (hist.get(Infinity) || 0) + 1); // +Inf bucket
  });

  next();
};

// Track WebSocket connections
export const trackSocketConnection = (delta: number) => {
  metrics.active_websocket_connections += delta;
};

// Track DB queries
export const trackDbQuery = (success: boolean) => {
  metrics.db_query_total++;
  if (!success) metrics.db_query_errors++;
};

// Prometheus-format metrics endpoint
export const metricsEndpoint = (req: Request, res: Response) => {
  let output = '';

  // HTTP requests total
  output += '# HELP http_requests_total Total HTTP requests\n';
  output += '# TYPE http_requests_total counter\n';
  for (const [labels, count] of metrics.http_requests_total) {
    output += `http_requests_total{${labels}} ${count}\n`;
  }

  // HTTP request duration histogram
  output += '\n# HELP http_request_duration_seconds HTTP request latency\n';
  output += '# TYPE http_request_duration_seconds histogram\n';
  for (const [labels, buckets] of latencyHistogram) {
    let cumulative = 0;
    for (const bucket of LATENCY_BUCKETS) {
      cumulative += buckets.get(bucket) || 0;
      output += `http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${cumulative}\n`;
    }
    cumulative += buckets.get(Infinity) || 0;
    output += `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${cumulative}\n`;
    output += `http_request_duration_seconds_count{${labels}} ${cumulative}\n`;
  }

  // WebSocket connections
  output += '\n# HELP active_websocket_connections Current WebSocket connections\n';
  output += '# TYPE active_websocket_connections gauge\n';
  output += `active_websocket_connections ${metrics.active_websocket_connections}\n`;

  // DB queries
  output += '\n# HELP db_queries_total Total database queries\n';
  output += '# TYPE db_queries_total counter\n';
  output += `db_queries_total{status="success"} ${metrics.db_query_total - metrics.db_query_errors}\n`;
  output += `db_queries_total{status="error"} ${metrics.db_query_errors}\n`;

  res.set('Content-Type', 'text/plain');
  res.send(output);
};

export default metricsMiddleware;
