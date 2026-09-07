import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('fullscreen timer protects short landscape and narrow viewport layout', async () => {
  const root = process.cwd();
  const [timer, clock] = await Promise.all([
    readFile(path.join(root, 'src/components/FullscreenTimer.tsx'), 'utf8'),
    readFile(path.join(root, 'src/components/FlipClock.tsx'), 'utf8'),
  ]);

  assert.match(timer, /height:\s*'100dvh'/);
  assert.match(timer, /sticky top-0/);
  assert.match(timer, /min-h-dvh/);
  assert.match(timer, /orientation:landscape/);
  assert.match(timer, /max-height:500px/);
  assert.match(timer, /flex-row/);
  assert.match(timer, /overflow-y-auto/);
  assert.match(clock, /width:\s*'clamp\(2\.4rem, 13vw, 8rem\)'/);
  assert.match(clock, /maxHeight:\s*'38dvh'/);
  assert.match(clock, /max-w-full flex-wrap/);
});
