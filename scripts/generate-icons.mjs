#!/usr/bin/env node
/**
 * Regenerate every StudyBuddy raster icon from one source of truth.
 *
 * Source: resources/logo/studybuddy-icon.svg (square tile) and
 *         resources/logo/studybuddy-icon-foreground.svg (Android adaptive layer).
 * Both reuse the exact geometry of the in-app motion logo (src/components/Logo.tsx),
 * so the launcher icon, favicon, PWA icons, and desktop icons all match the UI mark.
 *
 * Outputs:
 *   public/icons/icon-192.png, public/icons/icon-512.png     (PWA / web manifest)
 *   resources/desktop/icon.png, resources/desktop/tray.png   (Electron packaging)
 *   resources/android/launcher/mipmap-DENSITY/ic_launcher*.png  (legacy Android densities)
 *
 * Android vectors (adaptive/monochrome/background) are authored by hand in
 * resources/android/launcher/ and copied by scripts/prepare-android.mjs.
 *
 * Usage: node scripts/generate-icons.mjs [--check]
 *   --check verifies generated files exist and have the expected dimensions
 *           without rewriting them (useful in CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch (error) {
  console.error(
    'Unable to load "sharp", which is required to rasterize icons.\n' +
      'Install dependencies first: npm ci\n' +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const iconSvgPath = path.join(root, 'resources/logo/studybuddy-icon.svg');
const foregroundSvgPath = path.join(root, 'resources/logo/studybuddy-icon-foreground.svg');

for (const source of [iconSvgPath, foregroundSvgPath]) {
  if (!fs.existsSync(source)) {
    console.error(`Missing icon source: ${path.relative(root, source)}`);
    process.exit(1);
  }
}

const iconSvg = fs.readFileSync(iconSvgPath);
const foregroundSvg = fs.readFileSync(foregroundSvgPath);

/** Legacy launcher densities. Android uses 48dp launcher icons and a 108dp adaptive canvas. */
const densities = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

/**
 * Rasterize at the requested pixel size. `density` is raised so librsvg renders
 * the vector at full resolution instead of upscaling a small default bitmap.
 */
const render = (svg, size) =>
  sharp(svg, { density: Math.min(2400, Math.max(72, size * 4)) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Circular variant for launchers that request a round icon. */
const renderRound = async (svg, size) => {
  const square = await render(svg, size);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return sharp(square)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, build: () => render(iconSvg, 192) },
  { file: 'public/icons/icon-512.png', size: 512, build: () => render(iconSvg, 512) },
  { file: 'resources/desktop/icon.png', size: 512, build: () => render(iconSvg, 512) },
  { file: 'resources/desktop/tray.png', size: 192, build: () => render(iconSvg, 192) },
];

for (const { dir, launcher, foreground } of densities) {
  targets.push(
    {
      file: `resources/android/launcher/${dir}/ic_launcher.png`,
      size: launcher,
      build: () => render(iconSvg, launcher),
    },
    {
      file: `resources/android/launcher/${dir}/ic_launcher_round.png`,
      size: launcher,
      build: () => renderRound(iconSvg, launcher),
    },
    {
      file: `resources/android/launcher/${dir}/ic_launcher_foreground.png`,
      size: foreground,
      build: () => render(foregroundSvg, foreground),
    }
  );
}

let failures = 0;

for (const target of targets) {
  const absolute = path.join(root, target.file);
  if (checkOnly) {
    if (!fs.existsSync(absolute)) {
      console.error(`MISSING ${target.file}`);
      failures += 1;
      continue;
    }
    const metadata = await sharp(absolute).metadata();
    if (metadata.width !== target.size || metadata.height !== target.size) {
      console.error(
        `SIZE MISMATCH ${target.file}: expected ${target.size}x${target.size}, found ${metadata.width}x${metadata.height}`
      );
      failures += 1;
      continue;
    }
    console.log(`ok ${target.file} (${metadata.width}x${metadata.height})`);
    continue;
  }

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const buffer = await target.build();
  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== target.size || metadata.height !== target.size) {
    console.error(
      `Refusing to write ${target.file}: rendered ${metadata.width}x${metadata.height}, expected ${target.size}x${target.size}`
    );
    failures += 1;
    continue;
  }
  fs.writeFileSync(absolute, buffer);
  console.log(`wrote ${target.file} (${target.size}x${target.size})`);
}

if (failures > 0) {
  console.error(`${failures} icon target(s) failed.`);
  process.exit(1);
}

console.log(
  checkOnly
    ? 'All icons verified against the StudyBuddy logo sources.'
    : 'All icons regenerated from resources/logo/ (run scripts/prepare-android.mjs to apply Android launcher assets).'
);
