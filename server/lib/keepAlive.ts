/**
 * Render Free Tier Keep-Alive
 *
 * Prevent the service from sleeping (spinning down) by pinging itself every 14 minutes.
 * Render free tier sleeps after 15 minutes of inactivity.
 */

export function startKeepAlive() {
    if (process.env.KEEP_ALIVE !== 'true') return;

    // Default to the production URL if SELF_URL is not set
    const selfUrl = process.env.SELF_URL || 'https://api.satym.in';

    console.log(`⏰ Keep-alive service started for: ${selfUrl}`);

    // Ping immediately on startup (optional, but good for logs)
    ping(selfUrl);

    // Ping every 14 minutes
    setInterval(() => ping(selfUrl), 14 * 60 * 1000);
}

function ping(url: string) {
    fetch(`${url}/health`)
        .then(res => {
            if (res.ok) {
                // console.log(`✅ keep-alive ping success: ${res.status}`);
            } else {
                console.warn(`⚠️ keep-alive ping returned status: ${res.status}`);
            }
        })
        .catch(err => console.error(`❌ keep-alive ping failed: ${err.message}`));
}
