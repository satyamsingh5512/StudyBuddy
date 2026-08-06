'use client';

/**
 * BlurBlobs — the soft pastel depth layer behind the auth/marketing screens.
 *
 * The atmosphere comes from four large, heavily-blurred radial gradients rather
 * than shadows or frosted glass: 280–340px circles at 80px blur, in lavender /
 * peach / mint / apricot.
 *
 * A very slow 24s drift keeps the page from feeling like a screenshot. Disable
 * it with `drift={false}`; it is skipped automatically under reduced-motion.
 */

type Blob = {
  size: number;
  left: string;
  top: string;
  /** Inner colour of the radial gradient; fades to transparent at 70%. */
  rgb: string;
  alpha: number;
  /** Stagger so the four blobs never move in lockstep. */
  delay: string;
};

const BLOBS: readonly Blob[] = [
  { size: 340, left: '10%', top: '15%', rgb: '200, 180, 255', alpha: 0.4, delay: '0s' },
  { size: 300, left: '65%', top: '60%', rgb: '255, 200, 180', alpha: 0.35, delay: '-6s' },
  { size: 280, left: '50%', top: '10%', rgb: '180, 230, 220', alpha: 0.35, delay: '-12s' },
  { size: 320, left: '20%', top: '70%', rgb: '255, 220, 180', alpha: 0.3, delay: '-18s' },
];

export function BlurBlobs({ drift = true, className = '' }: { drift?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      {BLOBS.map((blob) => (
        <div
          key={`${blob.left}-${blob.top}`}
          className={`absolute rounded-full ${drift ? 'motion-safe:animate-blob-drift' : ''}`}
          style={{
            width: blob.size,
            height: blob.size,
            left: blob.left,
            top: blob.top,
            background: `radial-gradient(circle, rgba(${blob.rgb}, ${blob.alpha}) 0%, transparent 70%)`,
            filter: 'blur(80px)',
            animationDelay: blob.delay,
            willChange: drift ? 'transform' : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default BlurBlobs;
