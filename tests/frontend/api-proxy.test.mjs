import assert from 'node:assert/strict';
import test from 'node:test';

import nextConfig from '../../next.config.mjs';

test('proxies the browser /api path to an external backend API', async () => {
  const rewrites = await nextConfig.rewrites();
  const apiRewrite = rewrites.find((rewrite) => rewrite.source === '/api/:path*');

  assert.ok(apiRewrite, 'expected a catch-all /api rewrite');
  assert.match(apiRewrite.destination, /^https?:\/\/.+\/api\/:path\*$/);
  assert.notEqual(apiRewrite.destination, '/api/:path*');
});
