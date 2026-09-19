import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export type SidebarSide = 'left' | 'right';
/** expanded = icons + labels, rail = icons only, hidden = fully off-canvas. */
export type SidebarMode = 'expanded' | 'rail' | 'hidden';

export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_RAIL_WIDTH = 72;

// atomWithStorage keeps `getOnInit` false by default, so the server and the
// first client render both use these defaults and localStorage is applied after
// mount. That avoids hydration mismatches on the layout offsets.
const sidebarSideAtom = atomWithStorage<SidebarSide>('sb_sidebar_side_v1', 'left');
const sidebarModeAtom = atomWithStorage<SidebarMode>('sb_sidebar_mode_v1', 'expanded');
const sidebarWidthAtom = atomWithStorage<number>('sb_sidebar_width_v1', SIDEBAR_DEFAULT_WIDTH);
const sidebarOpenSectionsAtom = atomWithStorage<string[]>('sb_sidebar_sections_v1', ['plan']);

export function clampSidebarWidth(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(numeric)));
}

function safeSide(value: unknown): SidebarSide {
  return value === 'right' ? 'right' : 'left';
}

function safeMode(value: unknown): SidebarMode {
  return value === 'rail' || value === 'hidden' ? value : 'expanded';
}

/**
 * Shared sidebar geometry. Values are sanitised on read so a hand-edited or
 * stale localStorage entry can never produce an unusable layout.
 */
export function useSidebarLayout() {
  const [storedSide, setStoredSide] = useAtom(sidebarSideAtom);
  const [storedMode, setStoredMode] = useAtom(sidebarModeAtom);
  const [storedWidth, setStoredWidth] = useAtom(sidebarWidthAtom);
  const [storedSections, setStoredSections] = useAtom(sidebarOpenSectionsAtom);

  const side = safeSide(storedSide);
  const mode = safeMode(storedMode);
  const width = clampSidebarWidth(storedWidth);
  const openSections = Array.isArray(storedSections)
    ? storedSections.filter((id): id is string => typeof id === 'string')
    : [];

  const setWidth = useCallback(
    (next: number) => setStoredWidth(clampSidebarWidth(next)),
    [setStoredWidth]
  );

  const toggleSide = useCallback(
    () => setStoredSide((current) => (safeSide(current) === 'left' ? 'right' : 'left')),
    [setStoredSide]
  );

  const setSide = useCallback((next: SidebarSide) => setStoredSide(safeSide(next)), [setStoredSide]);

  const setMode = useCallback((next: SidebarMode) => setStoredMode(safeMode(next)), [setStoredMode]);

  const toggleRail = useCallback(
    () => setStoredMode((current) => (safeMode(current) === 'expanded' ? 'rail' : 'expanded')),
    [setStoredMode]
  );

  const toggleHidden = useCallback(
    () => setStoredMode((current) => (safeMode(current) === 'hidden' ? 'expanded' : 'hidden')),
    [setStoredMode]
  );

  const toggleSection = useCallback(
    (id: string) =>
      setStoredSections((current) => {
        const list = Array.isArray(current) ? current : [];
        return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
      }),
    [setStoredSections]
  );

  const openSection = useCallback(
    (id: string) =>
      setStoredSections((current) => {
        const list = Array.isArray(current) ? current : [];
        return list.includes(id) ? list : [...list, id];
      }),
    [setStoredSections]
  );

  return {
    side,
    mode,
    width,
    /** Space the panel actually occupies on desktop. */
    occupiedWidth: mode === 'hidden' ? 0 : mode === 'rail' ? SIDEBAR_RAIL_WIDTH : width,
    openSections,
    setSide,
    toggleSide,
    setMode,
    toggleRail,
    toggleHidden,
    setWidth,
    toggleSection,
    openSection,
  };
}
