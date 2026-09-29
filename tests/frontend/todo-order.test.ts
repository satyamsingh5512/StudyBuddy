import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { applyManualOrder, mergeOrder } from '../../src/lib/todoOrder.ts';

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((item) => item.id);

test('no manual order keeps the priority order untouched', () => {
  assert.deepEqual(ids(applyManualOrder(items('a', 'b', 'c'), [])), ['a', 'b', 'c']);
});

test('a dragged order is applied', () => {
  assert.deepEqual(ids(applyManualOrder(items('a', 'b', 'c'), ['c', 'a', 'b'])), ['c', 'a', 'b']);
});

test('new, never-dragged items keep their priority slot', () => {
  // 'n' is new and sat second in the priority list; it must stay there.
  assert.deepEqual(ids(applyManualOrder(items('a', 'n', 'b', 'c'), ['c', 'b', 'a'])), ['c', 'n', 'b', 'a']);
});

test('stale ids in the stored order are ignored', () => {
  assert.deepEqual(ids(applyManualOrder(items('a', 'b'), ['gone', 'b', 'a'])), ['b', 'a']);
});

test('merge keeps hidden ids after the visible ones, deduplicated and bounded', () => {
  assert.deepEqual(mergeOrder(['x', 'a', 'b'], ['b', 'a']), ['b', 'a', 'x']);
  const huge = Array.from({ length: 900 }, (_, i) => `id${i}`);
  assert.equal(mergeOrder(huge, ['new']).length, 500);
});

test('dashboard drag end writes the rendered order, not an unused state copy', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/views/Dashboard.tsx'), 'utf8');
  assert.match(source, /applyManualOrder\(/);
  assert.match(source, /setManualOrder\(/);
  assert.match(source, /saveTodoOrder\(user\?\.id/);
});
