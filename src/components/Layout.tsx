import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Trophy,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Newspaper,
  Users,
  LibraryBig,
  BrainCircuit,
} from 'lucide-react';
import { useAtom } from 'jotai';
import { userAtom, studyingAtom } from '@/store/atoms';
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
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import BuddyChat from './BuddyChat';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/news', icon: Newspaper, label: 'News' },
  { path: '/notices', icon: Bell, label: 'Notices' },
  { path: '/friends', icon: User, label: 'Friends' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [user] = useAtom(userAtom);
  const [studying] = useAtom(studyingAtom);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOnline } = useNetworkStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    soundManager.playClick();
    await apiFetch('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    soundManager.playClick();
  };

  return (
    <UnifiedPageWrapper>
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-40 supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5" />
            <h1 className="font-bold text-sm tracking-tight">StudyBuddy</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8 p-0"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Desktop & Mobile */}
        <aside
          className={`
          fixed md:sticky md:top-0 md:h-screen inset-y-0 left-0 z-40 w-64 border-r flex flex-col bg-card/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-card/80
          transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        >
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Logo className="w-8 h-8" />
                {studying && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-success">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  </span>
                )}
              </div>
              <h1 className="font-bold text-lg tracking-tight">StudyBuddy</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Profile - Mobile Only */}
          <div className="md:hidden p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={getAvatarUrl(user)}
                  alt={(user as any)?.username || user?.name}
                  className="h-10 w-10 rounded-full ring-2 ring-border"
                />
                {/* Network Status */}
                <span
                  className={`absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`}
                ></span>
                {/* Studying Status */}
                {studying && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-600 border-2 border-background"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {(user as any)?.username ? `@${(user as any).username}` : user?.name}
                </p>
                <p className="text-xs text-muted-foreground">{user?.totalPoints} points</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto w-full mt-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={handleNavClick} className="block w-full">
                    <div
                      className={`
                      flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md text-sm font-medium
                      transition-all duration-200 ease-out group relative overflow-hidden
                      ${isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }
                    `}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                      )}
                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground transition-colors'}`} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="p-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-3 rounded-md transition-all duration-200 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="font-medium text-sm">Sign out</span>
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop Header */}
          <header className="hidden md:flex h-16 border-b border-border/50 items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-30 supports-[backdrop-filter]:bg-background/80">
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
                  <button className="flex items-center gap-3 hover:opacity-80 transition-all duration-200 focus:outline-none group bg-secondary/50 hover:bg-secondary px-3 py-1.5 rounded-lg border border-border/50">
                    <div className="text-right hidden lg:block">
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        {(user as any)?.username ? `@${(user as any).username}` : user?.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{user?.totalPoints || 0} XP</p>
                    </div>
                    <div className="relative">
                      <img
                        src={getAvatarUrl(user)}
                        alt={(user as any)?.username || user?.name}
                        className="h-8 w-8 rounded-md ring-1 ring-border group-hover:ring-primary/50 transition-all duration-200 object-cover"
                      />
                      {/* Network Status */}
                      <span
                        className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background ${isOnline ? 'bg-success' : 'bg-destructive'
                          }`}
                      ></span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-background border border-border shadow-md rounded-xl p-2 z-50">
                  <DropdownMenuLabel className="font-bold text-sm tracking-wide text-foreground px-2 py-1.5">My Account</DropdownMenuLabel>
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

          <main className="flex-1 p-4 md:p-8 overflow-auto">
            <div className="max-w-[1280px] mx-auto h-full w-full">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </div>
          </main>
        </div>

        {/* Floating Widgets */}
        <BuddyChat />
      </div>
    </UnifiedPageWrapper>
  );
}
