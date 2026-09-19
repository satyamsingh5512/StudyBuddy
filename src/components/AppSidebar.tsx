'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeftRight,
  EyeOff,
  X,
} from 'lucide-react';
import { Link, useLocation } from '@/lib/router';
import { cn } from '@/lib/utils';
import type { User } from '@/store/atoms';
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_RAIL_WIDTH,
  useSidebarLayout,
} from '@/store/sidebarLayout';
import {
  findSectionForPath,
  isPathActive,
  navSections,
  navUtilityLinks,
  type NavSection,
} from '@/config/navigation';
import { getAvatarUrl } from '@/lib/avatar';
import { Button } from './ui/button';
import Logo from './Logo';

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  mobileCloseRef: React.RefObject<HTMLButtonElement>;
  onNavigate: () => void;
  onLogout: () => void;
  logoutPending: boolean;
  studying: boolean;
  isOnline: boolean;
  user: User | null;
}

interface FlyoutState {
  sectionId: string;
  top: number;
  left: number;
}

const FLYOUT_WIDTH = 224;

export default function AppSidebar({
  mobileOpen,
  onMobileClose,
  mobileCloseRef,
  onNavigate,
  onLogout,
  logoutPending,
  studying,
  isOnline,
  user,
}: AppSidebarProps) {
  const layout = useSidebarLayout();
  const location = useLocation();
  const [mounted, setMounted] = useState(false);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Persisted geometry is only applied after mount so the server markup and the
  // first client paint agree (see useSidebarLayout).
  useEffect(() => setMounted(true), []);

  const mode = mounted ? layout.mode : 'expanded';
  const side = mounted ? layout.side : 'left';
  const isRail = mode === 'rail' && !mobileOpen;
  const isHidden = mode === 'hidden';
  const showLabels = !isRail;

  const activeSection = useMemo(() => findSectionForPath(location.pathname), [location.pathname]);

  // Keep the section that owns the current route open, so a page reload never
  // lands the user on a route they cannot see in the tree.
  const openSection = layout.openSection;
  useEffect(() => {
    if (activeSection?.items?.length) openSection(activeSection.id);
  }, [activeSection, openSection]);

  useEffect(() => setFlyout(null), [location.pathname]);

  useEffect(() => {
    if (!isRail) setFlyout(null);
  }, [isRail]);

  // Close the rail flyout on outside pointer, Escape, scroll, or resize.
  useEffect(() => {
    if (!flyout) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (flyoutRef.current?.contains(target)) return;
      if (asideRef.current?.contains(target)) return;
      setFlyout(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlyout(null);
    };
    const dismiss = () => setFlyout(null);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [flyout]);

  // Ctrl/Cmd+B collapses to the icon rail, adding Shift hides the panel.
  const { toggleRail, toggleHidden } = layout;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'b') return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      if (event.shiftKey) toggleHidden();
      else toggleRail();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleHidden, toggleRail]);

  const openFlyout = useCallback(
    (section: NavSection, trigger: HTMLElement) => {
      const rect = trigger.getBoundingClientRect();
      const itemCount = section.items?.length ?? 0;
      const estimatedHeight = itemCount * 40 + 52;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - estimatedHeight - 8));
      const left =
        side === 'left'
          ? Math.min(rect.right + 8, window.innerWidth - FLYOUT_WIDTH - 8)
          : Math.max(8, rect.left - FLYOUT_WIDTH - 8);
      setFlyout((current) =>
        current?.sectionId === section.id ? null : { sectionId: section.id, top, left }
      );
    },
    [side]
  );

  const beginResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = layout.width;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = side === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
        layout.setWidth(startWidth + delta);
      };
      const handleUp = () => {
        document.body.style.userSelect = previousUserSelect;
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [layout, side]
  );

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      layout.setWidth(layout.width + (side === 'left' ? -step : step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      layout.setWidth(layout.width + (side === 'left' ? step : -step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      layout.setWidth(SIDEBAR_MIN_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      layout.setWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  // Drag the grip to move the whole panel to the other screen edge.
  const beginMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      setFlyout(null);

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        setDragOffset(Math.max(-72, Math.min(72, delta)));
        setDropSide(moveEvent.clientX > window.innerWidth / 2 ? 'right' : 'left');
      };
      const handleUp = (upEvent: PointerEvent) => {
        setDragOffset(null);
        setDropSide(null);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        if (Math.abs(upEvent.clientX - startX) < 24) return;
        layout.setSide(upEvent.clientX > window.innerWidth / 2 ? 'right' : 'left');
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [layout]
  );

  const RailToggleIcon = isRail
    ? side === 'left'
      ? PanelLeftOpen
      : PanelRightOpen
    : side === 'left'
      ? PanelLeftClose
      : PanelRightClose;

  const flyoutSection = flyout ? navSections.find((item) => item.id === flyout.sectionId) : null;

  const renderLeaf = (item: { path: string; label: string; icon: typeof GripVertical }) => {
    const Icon = item.icon;
    const active = isPathActive(location.pathname, item.path);
    return (
      <Link key={item.path} to={item.path} onClick={onNavigate} className="block w-full">
        <div
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
            active
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
        </div>
      </Link>
    );
  };

  return (
    <>
      <aside
        ref={asideRef}
        id="app-navigation"
        role="navigation"
        aria-label="Primary navigation"
        aria-hidden={!mobileOpen && isHidden ? true : undefined}
        style={{
          ['--sb-width' as string]: `${isRail ? SIDEBAR_RAIL_WIDTH : layout.width}px`,
          transform: dragOffset != null ? `translateX(${dragOffset}px)` : undefined,
        }}
        className={cn(
          'glass-panel fixed inset-y-0 z-40 w-[min(19rem,85vw)] flex-col border-y-0 shadow-2xl',
          'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]',
          'transition-[transform,width] duration-300 ease-in-out md:w-[var(--sb-width)] md:shadow-none',
          side === 'left' ? 'left-0 border-l-0' : 'right-0 border-r-0',
          mobileOpen ? 'flex translate-x-0' : 'hidden',
          isHidden ? 'md:hidden' : 'md:flex md:translate-x-0',
          !mobileOpen && (side === 'left' ? '-translate-x-full' : 'translate-x-full'),
          dragOffset != null && 'transition-none select-none'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-1 border-b border-border/50',
            isRail ? 'flex-col px-2 py-3' : 'px-3 py-4'
          )}
        >
          <button
            type="button"
            onPointerDown={beginMove}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                layout.toggleSide();
              }
            }}
            title="Drag to move the panel to the other side"
            aria-label={`Move panel to the ${side === 'left' ? 'right' : 'left'} side`}
            className="hidden h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing md:flex"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className={cn('flex min-w-0 flex-1 items-center gap-2.5', isRail && 'flex-none')}>
            <div className="relative shrink-0">
              <Logo className="h-7 w-7" />
              {studying && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-success">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                </span>
              )}
            </div>
            {showLabels && <h1 className="truncate text-base font-bold tracking-tight">StudyBuddy</h1>}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={layout.toggleRail}
            title={`${isRail ? 'Expand' : 'Collapse'} panel (Ctrl+B)`}
            aria-label={`${isRail ? 'Expand' : 'Collapse'} navigation panel`}
            aria-expanded={!isRail}
            className="hidden h-9 w-9 shrink-0 p-0 text-muted-foreground md:inline-flex"
          >
            <RailToggleIcon className="h-4 w-4" />
          </Button>

          <Button
            ref={mobileCloseRef}
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-0 md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="border-b border-border/50 p-4 md:hidden">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={getAvatarUrl(user)}
                alt={user?.username || user?.name || 'Profile'}
                className="h-10 w-10 rounded-full ring-2 ring-border"
              />
              <span
                className={cn(
                  'absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                  isOnline ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              {studying && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-blue-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.username ? `@${user.username}` : user?.name}
              </p>
              <p className="text-xs text-muted-foreground">{user?.totalPoints ?? 0} points</p>
            </div>
          </div>
        </div>

        <nav className={cn('w-full flex-1 overflow-y-auto overflow-x-hidden', isRail ? 'p-2' : 'p-3')}>
          <div className="space-y-1">
            {navSections.map((section) => {
              const Icon = section.icon;
              const isActiveSection = activeSection?.id === section.id;

              if (section.path) {
                const active = isPathActive(location.pathname, section.path);
                return (
                  <Link
                    key={section.id}
                    to={section.path}
                    onClick={onNavigate}
                    title={isRail ? section.label : undefined}
                    className="block w-full"
                  >
                    <div
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex min-h-11 items-center rounded-md text-sm font-medium transition-colors duration-200',
                        isRail ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      {active && (
                        <span
                          className={cn(
                            'absolute top-1/2 h-6 w-1 -translate-y-1/2 bg-primary',
                            side === 'left' ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'
                          )}
                        />
                      )}
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {showLabels && <span className="truncate">{section.label}</span>}
                    </div>
                  </Link>
                );
              }

              const expanded = isRail
                ? flyout?.sectionId === section.id
                : layout.openSections.includes(section.id);

              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={(event) => {
                      if (isRail) openFlyout(section, event.currentTarget);
                      else layout.toggleSection(section.id);
                    }}
                    aria-expanded={expanded}
                    aria-controls={isRail ? undefined : `nav-section-${section.id}`}
                    title={isRail ? section.label : undefined}
                    className={cn(
                      'relative flex min-h-11 w-full items-center rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isRail ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                      isActiveSection
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      isActiveSection && (isRail || !expanded) && 'bg-primary/10'
                    )}
                  >
                    {isActiveSection && (
                      <span
                        className={cn(
                          'absolute top-1/2 h-6 w-1 -translate-y-1/2 bg-primary',
                          side === 'left' ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'
                        )}
                      />
                    )}
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    {showLabels && (
                      <>
                        <span className="flex-1 truncate text-left">{section.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                            expanded && 'rotate-180'
                          )}
                        />
                      </>
                    )}
                    {isRail && (
                      <ChevronRight
                        className={cn(
                          'absolute h-3 w-3 opacity-50',
                          side === 'left' ? 'right-0.5' : 'left-0.5 rotate-180'
                        )}
                      />
                    )}
                  </button>

                  {showLabels && expanded && (
                    <div
                      id={`nav-section-${section.id}`}
                      className={cn(
                        'mt-1 space-y-0.5 border-border/60',
                        side === 'left' ? 'ml-5 border-l pl-2' : 'mr-5 border-r pr-2'
                      )}
                    >
                      {section.items?.map(renderLeaf)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={cn('border-t border-border/50', isRail ? 'space-y-1 p-2' : 'space-y-1 p-3')}>
          <div className={cn('flex gap-1', isRail ? 'flex-col items-center' : 'items-center')}>
            {navUtilityLinks.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(location.pathname, item.path);
              return (
                <Link key={item.path} to={item.path} onClick={onNavigate} title={item.label}>
                  <span
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={layout.toggleSide}
              title={`Dock panel to the ${side === 'left' ? 'right' : 'left'}`}
              aria-label={`Dock panel to the ${side === 'left' ? 'right' : 'left'}`}
              className="hidden h-10 w-10 p-0 text-muted-foreground md:inline-flex"
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={layout.toggleHidden}
              title="Hide panel (Ctrl+Shift+B)"
              aria-label="Hide navigation panel"
              className="hidden h-10 w-10 p-0 text-muted-foreground md:inline-flex"
            >
              <EyeOff className="h-[18px] w-[18px]" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            loading={logoutPending}
            loadingLabel={isRail ? undefined : 'Signing out…'}
            title="Sign out"
            aria-label="Sign out"
            className={cn(
              'w-full gap-3 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
              isRail ? 'justify-center px-0' : 'justify-start'
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {showLabels && <span className="text-sm font-medium">Sign out</span>}
          </Button>
        </div>

        {!isRail && !mobileOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize navigation panel"
            aria-valuenow={layout.width}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            onPointerDown={beginResize}
            onKeyDown={handleResizeKeyDown}
            className={cn(
              'absolute inset-y-0 hidden w-1.5 cursor-col-resize transition-colors hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none md:block',
              side === 'left' ? 'right-0' : 'left-0'
            )}
          />
        )}
      </aside>

      {/* Drop target hint while the panel is being dragged across the screen. */}
      {mounted &&
        dropSide &&
        createPortal(
          <div
            aria-hidden
            className={cn(
              'pointer-events-none fixed inset-y-0 z-[45] w-1.5 bg-primary/70',
              dropSide === 'left' ? 'left-0' : 'right-0'
            )}
          />,
          document.body
        )}

      {/* Rail flyout: the grouped destinations stay one click away when collapsed. */}
      {mounted &&
        isRail &&
        flyout &&
        flyoutSection &&
        createPortal(
          <div
            ref={flyoutRef}
            role="group"
            aria-label={flyoutSection.label}
            style={{ top: flyout.top, left: flyout.left, width: FLYOUT_WIDTH }}
            className="fixed z-50 rounded-xl border border-border bg-popover p-2 shadow-xl"
          >
            <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {flyoutSection.label}
            </p>
            <div className="space-y-0.5">{flyoutSection.items?.map(renderLeaf)}</div>
          </div>,
          document.body
        )}
    </>
  );
}
