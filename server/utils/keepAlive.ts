import https from 'https';
import http from 'http';

/**
 * Keep-alive service to prevent Render free tier from spinning down
 * Pings the health endpoint every 14 minutes (Render timeout is 15 minutes)
 */
export class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null;

  private readonly PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

  private readonly serverUrl: string;

  private requestCount = 0;

  constructor(serverUrl?: string) {
    // Default to Render URL if not provided
    this.serverUrl = serverUrl || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
  }

  /**
   * Start the keep-alive service
   */
  start(): void {
    if (this.intervalId) {
      console.log('⚠️  Keep-alive service is already running');
      return;
    }

    // Only run in production on Render
    if (process.env.NODE_ENV !== 'production' || !process.env.RENDER) {
      console.log('ℹ️  Keep-alive service disabled (not running on Render)');
      return;
    }

    console.log('🔄 Starting keep-alive service...');
    console.log(`📍 Target URL: ${this.serverUrl}/api/health`);
    console.log(`⏱️  Ping interval: ${this.PING_INTERVAL / 1000 / 60} minutes`);

    // Ping immediately on start
    this.ping();

    // Set up recurring pings
    this.intervalId = setInterval(() => {
      this.ping();
    }, this.PING_INTERVAL);

    console.log('✅ Keep-alive service started successfully\n');
  }

  /**
   * Stop the keep-alive service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Keep-alive service stopped');
    }
  }

  /**
   * Ping the health endpoint
   */
  private ping(): void {
    const url = `${this.serverUrl}/api/health`;
    const protocol = url.startsWith('https') ? https : http;

    this.requestCount += 1;

    protocol
      .get(url, (res) => {
        if (res.statusCode === 200) {
          console.log(`✅ Keep-alive ping #${this.requestCount} successful at ${new Date().toISOString()}`);
        } else {
          console.error(`⚠️  Keep-alive ping #${this.requestCount} returned status ${res.statusCode}`);
        }
      })
      .on('error', (err) => {
        console.error(`❌ Keep-alive ping #${this.requestCount} failed:`, err.message);
      });
  }

  /**
   * Get ping statistics
   */
  getStats(): { requestCount: number; isRunning: boolean } {
    return {
      requestCount: this.requestCount,
      isRunning: this.intervalId !== null,
    };
  }
}

// Singleton instance
export const keepAliveService = new KeepAliveService();
