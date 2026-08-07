import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInstallPlatform, installInstructions } from '../../src/lib/pwa.ts';

test('standalone mode takes precedence over browser platform', () => {
  assert.equal(detectInstallPlatform({ userAgent: 'iPhone', standalone: true }), 'standalone');
  assert.match(installInstructions({ userAgent: 'iPhone', standalone: true }).title, /installed/i);
});

test('iOS instructions use Safari share and home screen workflow', () => {
  const result = installInstructions({ userAgent: 'Mozilla/5.0 (iPhone)', standalone: false });
  assert.equal(result.canPrompt, false);
  assert.match(result.steps.join(' '), /Safari/);
  assert.match(result.steps.join(' '), /Add to Home Screen/);
});

test('Chromium exposes captured install prompt only when available', () => {
  const result = installInstructions({ userAgent: 'Mozilla Chrome/130.0', standalone: false, installPromptAvailable: true });
  assert.equal(result.canPrompt, true);
  assert.match(result.steps.join(' '), /Install button/);
});
