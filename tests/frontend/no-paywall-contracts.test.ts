import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

/**
 * StudyBuddy is free, permanently, and the user must never be charged.
 *
 * There is no paywall in the product today. This test exists so that stays a
 * deliberate property rather than an accident: a paywall is the kind of feature
 * that gets added quietly alongside a dependency, and once a billing SDK and a
 * price string are in the tree the pressure to ship it is hard to reverse.
 *
 * It is a source-level guard, not a behavioural one, so it deliberately errs on
 * scanning too much rather than missing a checkout flow.
 */

const MONETIZATION_DEPENDENCIES = [
  'stripe',
  '@stripe/stripe-js',
  'revenuecat',
  'purchases-ios',
  'purchases-android',
  'in-app-purchases',
  'paddle',
  'braintree',
  'razorpay',
  'lemonsqueezy',
  'gumroad',
  'chargebee',
];

const MONETIZATION_TOKENS = [
  'paywall',
  'checkout',
  'stripe',
  'revenuecat',
  'razorpay',
  'lemonsqueezy',
  'priceId',
  'productId',
  'subscriptionId',
  'inapppurchase',
  'in-app-purchase',
  'createOrder',
];

/** Every user-facing source area, plus native sources where an SDK could hide. */
const SCANNED_ROOTS = ['src', 'app', 'resources/android', 'backend'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.kt', '.java', '.go', '.xml']);

async function collectSourceFiles(dir: string, found: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path.join(process.cwd(), dir), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    // Build output and vendored trees are generated, not authored.
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.next') continue;
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(relative, found);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(relative);
    }
  }
  return found;
}

test('no billing or purchase SDK is declared as a dependency', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const declared = Object.keys({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  });
  const offenders = declared.filter((name) =>
    MONETIZATION_DEPENDENCIES.some((token) => name.toLowerCase().includes(token))
  );
  assert.deepEqual(
    offenders,
    [],
    `StudyBuddy is free and must not gain a payment dependency. Found: ${offenders.join(', ')}`
  );
});

test('no source file references a paywall or checkout flow', async () => {
  const offenders: string[] = [];
  for (const root of SCANNED_ROOTS) {
    for (const file of await collectSourceFiles(root)) {
      const contents = await readFile(path.join(process.cwd(), file), 'utf8');
      const lower = contents.toLowerCase();
      for (const token of MONETIZATION_TOKENS) {
        if (lower.includes(token.toLowerCase())) {
          offenders.push(`${file} -> ${token}`);
          break;
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `StudyBuddy must stay free. These files mention a monetization concept:\n${offenders.join('\n')}`
  );
});

test('the backend exposes no payment routes', async () => {
  const files = await collectSourceFiles('backend');
  const offenders: string[] = [];
  for (const file of files) {
    const contents = (await readFile(path.join(process.cwd(), file), 'utf8')).toLowerCase();
    for (const route of ['/billing', '/checkout', '/payment', '/subscription', '/webhook/stripe']) {
      if (contents.includes(route)) {
        offenders.push(`${file} -> ${route}`);
        break;
      }
    }
  }
  assert.deepEqual(offenders, [], `Unexpected payment route(s):\n${offenders.join('\n')}`);
});

test('no user-facing copy promises a future paid tier', async () => {
  const files = [
    ...(await collectSourceFiles('src/views')),
    ...(await collectSourceFiles('src/components')),
  ];
  // Phrases that would tell a user money is planned, which is a promise this
  // project has decided not to make.
  const forbidden = ['paid tier', 'premium plan', 'pro plan', 'upgrade to pro', 'subscribe now', 'free trial'];
  const offenders: string[] = [];
  for (const file of files) {
    const lower = (await readFile(path.join(process.cwd(), file), 'utf8')).toLowerCase();
    for (const phrase of forbidden) {
      if (lower.includes(phrase)) {
        offenders.push(`${file} -> "${phrase}"`);
        break;
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `StudyBuddy is free with no paid tiers, so copy must not imply one:\n${offenders.join('\n')}`
  );
});
