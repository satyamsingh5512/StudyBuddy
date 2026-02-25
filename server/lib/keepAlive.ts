/**
 * Render Free Tier Keep-Alive
 *
 * Prevents the service from sleeping by pinging itself every 5 minutes.
 * Render free tier sleeps after 15 minutes of inactivity.
 * Interval is 5 min to ensure even 2 consecutive failures don't cause a sleep.
 */

const PING_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15 * 1000;         // 15 seconds between retries

export function startKeepAlive() {
    if (process.env.KEEP_ALIVE !== 'true') return;

    // Render's fromService.property: host gives just hostname — ensure scheme is present
    let rawUrl = process.env.SELF_URL || 'https://studybuddy-api-s1bx.onrender.com';
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = `https://${rawUrl}`;
    }
    const selfUrl = rawUrl.replace(/\/$/, '');

    console.log(`⏰ Keep-alive started — pinging ${selfUrl}/health every ${PING_INTERVAL_MS / 60000} minutes`);

    // Ping immediately on startup
    pingWithRetry(selfUrl);

    // Ping every 5 minutes — well within Render's 15-min sleep threshold
    setInterval(() => pingWithRetry(selfUrl), PING_INTERVAL_MS);
}

async function pingWithRetry(baseUrl: string, attempt = 1): Promise<void> {
    try {
        const res = await fetch(`${baseUrl}/health`, {
            signal: AbortSignal.timeout(10_000), // 10s timeout per request
        });
        if (res.ok) {
            console.log(`✅ Keep-alive ping OK [${new Date().toISOString()}]`);
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err: any) {
        console.error(`❌ Keep-alive ping attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
        if (attempt < MAX_RETRIES) {
            setTimeout(() => pingWithRetry(baseUrl, attempt + 1), RETRY_DELAY_MS);
        } else {
            console.error('⛔ All keep-alive ping retries exhausted — server may sleep soon');
        }
    }
}
