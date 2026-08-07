import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

test('manifest declares standalone app and required icon sizes', async () => {
  const source = await readFile(path.join(root, 'app/manifest.ts'), 'utf8');
  assert.match(source, /display:\s*'standalone'/);
  assert.match(source, /192x192/);
  assert.match(source, /512x512/);
});

test('service worker excludes APIs, navigations, documents, and private responses', async () => {
  const source = await readFile(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /request\.mode === 'navigate'/);
  assert.match(source, /request\.destination === 'document'/);
  assert.match(source, /cache-control.*private/si);
  assert.doesNotMatch(source, /caches\.open\([^)]*\).*fetch\('\/api/si);
});
