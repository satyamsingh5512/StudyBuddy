import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (root: string, file: string) => readFile(path.join(root, file), 'utf8');

test('Dashboard drag-and-drop uses MouseSensor and TouchSensor, not PointerSensor', async () => {
  const root = process.cwd();
  const dashboard = await read(root, 'src/views/Dashboard.tsx');

  // Must import MouseSensor and TouchSensor, not PointerSensor
  assert.match(dashboard, /import\s+\{[^}]*MouseSensor[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/);
  assert.match(dashboard, /import\s+\{[^}]*TouchSensor[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/);
  assert.doesNotMatch(dashboard, /import\s+\{[^}]*PointerSensor[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/);

  // TouchSensor must have activation constraint with delay and tolerance
  assert.match(dashboard, /TouchSensor.*activationConstraint.*delay:\s*180.*tolerance:\s*6/s);
  assert.match(dashboard, /MouseSensor.*activationConstraint.*distance:\s*3/s);

  // KeyboardSensor must be present
  assert.match(dashboard, /useSensor\(KeyboardSensor/);
});

test('Dashboard drag handles meet 40x40px minimum touch target', async () => {
  const root = process.cwd();
  const dashboard = await read(root, 'src/views/Dashboard.tsx');

  // Drag handle must have min-h-10 min-w-10 (40px each)
  assert.match(dashboard, /min-h-10\s+min-w-10.*GripVertical/s);
});

test('Dashboard sortable list does not use AnimatePresence to avoid layout animation jank', async () => {
  const root = process.cwd();
  const dashboard = await read(root, 'src/views/Dashboard.tsx');

  // Regular todos must NOT be wrapped in AnimatePresence
  const sortableContextMatch = dashboard.match(/<SortableContext[\s\S]*?<\/SortableContext>/);
  assert.ok(sortableContextMatch, 'SortableContext block not found');
  const sortableBlock = sortableContextMatch[0];

  // Should NOT contain AnimatePresence
  assert.doesNotMatch(sortableBlock, /<AnimatePresence/);

  // Comment should explain why
  assert.match(dashboard, /No AnimatePresence here to avoid layout animation jank/);
});

test('Dashboard callbacks passed to SortableTodoItem are useCallback-stable', async () => {
  const root = process.cwd();
  const dashboard = await read(root, 'src/views/Dashboard.tsx');

  // toggleTodo, deleteTodo, rescheduleToToday, editTodo, openRescheduleModal must all be useCallback
  assert.match(dashboard, /const\s+toggleTodo\s*=\s*useCallback/);
  assert.match(dashboard, /const\s+deleteTodo\s*=\s*useCallback/);
  assert.match(dashboard, /const\s+rescheduleToToday\s*=\s*useCallback/);
  assert.match(dashboard, /const\s+editTodo\s*=\s*useCallback/);
  assert.match(dashboard, /const\s+openRescheduleModal\s*=\s*useCallback/);

  // SortableTodoItem handlers must also be useCallback
  assert.match(dashboard, /handleStartEdit\s*=\s*useCallback/);
  assert.match(dashboard, /handleSave\s*=\s*useCallback/);
  assert.match(dashboard, /handleCancel\s*=\s*useCallback/);
  assert.match(dashboard, /handleKeyDown\s*=\s*useCallback/);
});

test('Tasks view uses break-words not truncate, and meets 44px touch targets', async () => {
  const root = process.cwd();
  const tasks = await read(root, 'src/views/Tasks.tsx');

  // Task title and subtitle must use break-words, not truncate
  assert.match(tasks, /block break-words text-\[14px\]/);
  assert.match(tasks, /block break-words text-\[11px\]/);

  // Buttons must be min-h-11 min-w-11 (44px each)
  assert.match(tasks, /h-11 w-11.*grid.*place-items-center/s);
});

test('Invite view uses min-h-11 buttons and break-words text', async () => {
  const root = process.cwd();
  const invite = await read(root, 'src/views/Invite.tsx');

  // Buttons must have min-h-11 class
  assert.match(invite, /Button.*className="[^"]*min-h-11/);

  // Text must use break-words where needed
  assert.match(invite, /break-words/);

  // Icons must be flex-shrink-0
  assert.match(invite, /flex-shrink-0.*text-primary/s);

  // Safe area inset must be applied
  assert.match(invite, /pb-\[max\(2\.5rem,env\(safe-area-inset-bottom\)\)\]/);
});

test('Global CSS reduces blur radius on small screens', async () => {
  const root = process.cwd();
  const css = await read(root, 'src/index.css');

  // Mobile media query must reduce blur, not remove it entirely
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /backdrop-filter:\s*blur\(8px\)\s*saturate\(140%\)/);
  assert.match(css, /backdrop-filter:\s*blur\(10px\)\s*saturate\(150%\)/);
  assert.match(css, /backdrop-filter:\s*blur\(6px\)\s*saturate\(130%\)/);
});

test('Global CSS respects prefers-reduced-motion', async () => {
  const root = process.cwd();
  const css = await read(root, 'src/index.css');

  // Must have prefers-reduced-motion media query
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  // Must shorten animations
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);

  // dnd-kit data attribute must allow transforms
  assert.match(css, /\[data-dnd-kit\]/);
});

test('Dashboard todo titles use break-words to prevent overflow', async () => {
  const root = process.cwd();
  const dashboard = await read(root, 'src/views/Dashboard.tsx');

  // View mode title
  assert.match(dashboard, /text-sm break-words.*\{todo\.title\}/s);

  // DragOverlay title
  assert.match(dashboard, /text-sm break-words.*\{activeDragTodo\.title\}/s);
});

test('AppSidebar mobile navigation uses min-h-11 min-w-11 buttons', async () => {
  const root = process.cwd();
  const sidebar = await read(root, 'src/components/AppSidebar.tsx');

  // Mobile close button must be min-h-11 min-w-11
  assert.match(sidebar, /min-h-11 min-w-11.*md:hidden/);

  // Navigation items must be min-h-11
  assert.match(sidebar, /min-h-11.*items-center.*rounded-md/s);
});

test('Layout mobile header uses proper touch targets', async () => {
  const root = process.cwd();
  const layout = await read(root, 'src/components/Layout.tsx');

  // Mobile menu button must be h-11 w-11
  assert.match(layout, /h-11 w-11.*p-0.*md:hidden/s);
});
