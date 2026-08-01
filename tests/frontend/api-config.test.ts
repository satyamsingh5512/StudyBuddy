import assert from 'node:assert/strict';
import test from 'node:test';

import { API_URL, apiUrl } from '../../src/config/api.ts';

test('builds browser API requests on the same-origin /api path', () => {
  assert.equal(API_URL, '/api');
  assert.equal(apiUrl('/auth/me'), '/api/auth/me');
});
