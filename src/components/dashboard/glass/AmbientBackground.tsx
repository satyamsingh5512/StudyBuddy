/**
 * AmbientBackground — gradient-mesh backdrop for the dashboard. Renders
 * fixed, full-viewport, z-indexed below all glass surfaces. Pure CSS
 * (@keyframes) drift — costs nothing on the main thread. Does NOT itself
 * carry backdrop-filter; it's the thing being blurred by glass surfaces
 * above it, not a glass layer itself.
 *
 * Server-renderable (no hooks/state needed) — safe to mount once per
 * dashboard page load.
 */
export function AmbientBackground() {
  return (
    <div className="sbd-ambient-bg" aria-hidden="true">
      <div className="sbd-ambient-bg__blob sbd-ambient-bg__blob--1" />
      <div className="sbd-ambient-bg__blob sbd-ambient-bg__blob--2" />
      <div className="sbd-ambient-bg__blob sbd-ambient-bg__blob--3" />
    </div>
  );
}
