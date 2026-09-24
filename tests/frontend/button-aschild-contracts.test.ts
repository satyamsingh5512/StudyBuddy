import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

/**
 * Regression guard for the crash that took out every page containing a
 * <Button asChild> (Settings, Study Rooms, a Study Room).
 *
 * Radix's SlotClone does:
 *   if (isValidElement(children)) { ...clone... }
 *   return Children.count(children) > 1 ? Children.only(null) : null;
 *
 * The old Button always rendered TWO children inside the Slot:
 *   {loading && <span/>}
 *   {loading && loadingLabel ? loadingLabel : children}
 * which makes `children` an array (`[false, <Link/>]`). An array is not a valid
 * element and its count is 2, so Children.only(null) threw
 * "React.Children.only expected to receive a single React element child",
 * and app/error.tsx rendered "This page could not load".
 */
test('Button asChild renders exactly one child into Radix Slot', async () => {
  const source = await read('src/components/ui/button.tsx');

  // There must be a dedicated asChild branch...
  assert.match(source, /if \(asChild\)/, 'asChild must be handled in its own branch');

  const asChildBranch = source.slice(source.indexOf('if (asChild)'), source.indexOf('return (\n      <button'));

  // ...that renders {children} and nothing else inside <Slot>.
  assert.match(asChildBranch, /<Slot[\s\S]*>\s*\{children\}\s*<\/Slot>/, 'Slot must receive only {children}');
  // The spinner must not be injected into the Slot branch.
  assert.doesNotMatch(asChildBranch, /animate-spin/, 'the loading spinner must not be a second Slot child');
  assert.doesNotMatch(asChildBranch, /loadingLabel \? loadingLabel : children/, 'no conditional label as a second child');

  // The generic `Comp = asChild ? Slot : 'button'` shape is what caused the bug,
  // because both children were always emitted regardless of the element type.
  assert.doesNotMatch(source, /const Comp = asChild \? Slot : 'button'/, 'do not reintroduce the shared Comp render path');

  // `disabled` is invalid on the arbitrary element a caller slots in.
  assert.match(asChildBranch, /aria-disabled=/, 'asChild must express disabled state accessibly');
});

test('the non-asChild Button keeps its loading affordance', async () => {
  const source = await read('src/components/ui/button.tsx');
  const buttonBranch = source.slice(source.indexOf("return (\n      <button"));

  assert.match(buttonBranch, /animate-spin/, 'the plain button keeps the spinner');
  assert.match(buttonBranch, /loading \&\& loadingLabel \? loadingLabel : children/, 'the plain button keeps loadingLabel');
  assert.match(buttonBranch, /disabled=\{disabled \|\| loading\}/, 'a real <button> still uses the disabled attribute');
});
