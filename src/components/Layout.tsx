import { useLocation, useNavigate } from '@/lib/router';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Settings,
  PanelLeftOpen,
  PanelRightOpen,
} from 'lucide-react';
import { useAtom } from 'jotai';
import { userAtom, studyingAtom, studyTimeAtom, timerSessionStartAtom } from '@/store/atoms';
import { useSidebarLayout } from '@/store/sidebarLayout';
import { useNetworkStatus } from '@/lib/networkStatus';
import { getAvatarUrl } from '@/lib/avatar';
import PageTransition from '@/components/PageTransition';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import AppSidebar from '@/components/AppSidebar';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import ShowUpReminderManager from '@/components/ShowUpReminderManager';

import { apiFetch } from '@/config/api';
import { clearOfflineAccountData } from '@/lib/offline/storage';
import { soundManager } from '@/lib/sounds';
import { announceFocusEnd, clearLocalFocusState } from '@/lib/focusSession';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useAtom(userAtom);
  const [studying, setStudying] = useAtom(studyingAtom);
  const [, setStudyTime] = useAtom(studyTimeAtom);
  const [timerSessionStart, setTimerSessionStart] = useAtom(timerSessionStartAtom);
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const { isOnline } = useNetworkStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebar = useSidebarLayout();

  const handleLogout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    soundManager.playClick();
    try {
      // End the cross-device focus lease before clearing the local marker. If
      // the request is offline, focusSession persists an end intent for the
      // next authenticated sync instead of leaking this account's session.
      if (timerSessionStart || studying) await announceFocusEnd('logout');
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      // Intentional logout wins over offline durability: queued writes and
      // cached records must never be replayed under a different account.
      setUser(null);
      setStudying(false);
      setStudyTime(0);
      setTimerSessionStart(null);
      clearLocalFocusState();
      queryClient.clear();
      await Promise.allSettled([
        clearOfflineAccountData(),
        import('@/lib/nativeFocusEnforcer')
          .then(({ disableNativeFocusEnforcer }) => disableNativeFocusEnforcer())
          .catch(() => null),
      ]);
      setLogoutPending(false);
      window.location.assign('/');
    }
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const frame = window.requestAnimationFrame(() => mobileMenuCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = document.getElementById('app-navigation');
      const focusable = drawer
        ? Array.from(
            drawer.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) mobileMenuTriggerRef.current?.focus();
  }, [mobileMenuOpen]);

  // A route change must not leave the mobile drawer covering the new page.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    soundManager.playClick();
  };

  const RestoreIcon = sidebar.side === 'left' ? PanelLeftOpen : PanelRightOpen;

  return (
    <UnifiedPageWrapper>
      <ShowUpReminderManager />
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-background px-4 py-2 text-foreground shadow-lg focus:not-sr-only"
      >
        Skip to main content
      </a>
      <div
        style={{
          ['--sb-ml' as string]: sidebar.side === 'left' ? `${sidebar.occupiedWidth}px` : '0px',
          ['--sb-mr' as string]: sidebar.side === 'right' ? `${sidebar.occupiedWidth}px` : '0px',
        }}
        className="min-h-screen flex flex-col md:h-dvh md:min-h-0 md:flex-row md:overflow-hidden"
      >
        <header className="glass-panel md:hidden h-14 border-x-0 border-t-0 flex items-center justify-between gap-2 px-3 sm:px-4 sticky top-0 z-40">
          {/* RESPONSIVE FIX: Touch targets min 44x44px */}
          <div className="flex min-w-0 items-center gap-2">
            <Logo className="w-5 h-5" />
            <h1 className="truncate font-bold text-sm tracking-tight">StudyBuddy</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              loading={logoutPending}
              loadingLabel="Signing out…"
              className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              ref={mobileMenuTriggerRef}
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-navigation"
              className="h-11 w-11 p-0"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-background/40 backdrop-blur-sm z-30 transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <AppSidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          mobileCloseRef={mobileMenuCloseRef}
          onNavigate={handleNavClick}
          onLogout={handleLogout}
          logoutPending={logoutPending}
          studying={studying}
          isOnline={isOnline}
          user={user}
        />

        {/* Panel fully hidden: keep one affordance to bring it back. */}
        {sidebar.mode === 'hidden' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => sidebar.setMode('expanded')}
            title="Show navigation panel (Ctrl+Shift+B)"
            aria-label="Show navigation panel"
            className={`hidden md:inline-flex fixed top-1/2 -translate-y-1/2 z-40 h-16 w-8 items-center justify-center rounded-2xl p-0 ${
              sidebar.side === 'left' ? 'left-0 rounded-l-none' : 'right-0 rounded-r-none'
            }`}
          >
            <RestoreIcon className="h-4 w-4" />
          </Button>
        )}

        <div className="flex-1 flex flex-col min-w-0 md:h-dvh md:min-h-0 md:ml-[var(--sb-ml)] md:mr-[var(--sb-mr)] md:transition-[margin] md:duration-300 md:ease-in-out">
          <header className="glass-panel hidden md:flex h-16 border-x-0 border-t-0 items-center justify-between px-6 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              {studying && (
                <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-success/10 text-success transition-all duration-200 border border-success/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  Session Active
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 bg-secondary/50 hover:bg-secondary px-3 py-1.5 rounded-lg border border-border/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group">
                    <div className="text-right hidden lg:block">
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        {(user as any)?.username ? `@${(user as any).username}` : user?.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {user?.totalPoints || 0} XP
                      </p>
                    </div>
                    <div className="relative">
                      <img
                        src={getAvatarUrl(user)}
                        alt={(user as any)?.username || user?.name}
                        className="h-8 w-8 rounded-md ring-1 ring-border group-hover:ring-primary/50 transition-all duration-200 object-cover"
                      />
                      <span
                        className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background ${
                          isOnline ? 'bg-success' : 'bg-destructive'
                        }`}
                      ></span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 bg-background border border-border shadow-md rounded-xl p-2 z-50"
                >
                  <DropdownMenuLabel className="font-bold text-sm tracking-wide text-foreground px-2 py-1.5">
                    My Account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border my-1" />
                  <DropdownMenuItem
                    onClick={() => navigate('/settings')}
                    className="cursor-pointer focus:bg-primary/10 focus:text-primary rounded-lg px-3 py-2 transition-colors flex items-center gap-3"
                  >
                    <User className="h-4 w-4" />
                    <span className="font-semibold">Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate('/settings')}
                    className="cursor-pointer focus:bg-primary/10 focus:text-primary rounded-lg px-3 py-2 transition-colors flex items-center gap-3"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="font-semibold">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border my-1" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg px-3 py-2 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="font-semibold">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            aria-hidden={mobileMenuOpen ? true : undefined}
            className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
            style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}
          >
            {/* RESPONSIVE FIX: Fluid max-width and padding */}
            <div className="mx-auto h-full w-full" style={{ maxWidth: 'min(1280px, 100%)' }}>
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
    </UnifiedPageWrapper>
  );
}
