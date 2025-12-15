import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useState } from 'react';
import { userAtom, studyingAtom } from '@/store/atoms';
import { useNetworkStatus } from '@/lib/networkStatus';
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
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/notices', icon: Bell, label: 'Notices' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
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
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    soundManager.playClick();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden h-14 border-b flex items-center justify-between px-4 bg-background sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Logo className="w-5 h-5" />
          <h1 className="font-semibold text-sm">StudyBuddy</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-8 w-8 p-0"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
          fixed md:static inset-y-0 left-0 z-40 w-64 md:w-56 border-r flex flex-col bg-background
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Logo className="w-6 h-6" />
              {studying && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-600">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75"></span>
                </span>
              )}
            </div>
            <h1 className="font-semibold">StudyBuddy</h1>
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
                src={user?.avatar || 'https://via.placeholder.com/40'}
                alt={(user as any)?.username || user?.name}
                className="h-10 w-10 rounded-full ring-2 ring-border"
              />
              {/* Network Status */}
              <span className={`absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
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

        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={handleNavClick}>
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-md text-sm 
                      transition-all duration-200 ease-in-out
                      ${
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-sm scale-[1.02]'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:scale-[1.01] active:scale-[0.98]'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 border-b items-center justify-between px-4 lg:px-6 bg-background sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {studying && (
              <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-green-600/10 text-green-600 transition-all duration-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                </span>
                Studying
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-all duration-200 focus:outline-none group">
                  <div className="text-right hidden lg:block">
                    <p className="text-sm font-medium">
                      {(user as any)?.username ? `@${(user as any).username}` : user?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.totalPoints} points</p>
                  </div>
                  <div className="relative">
                    <img
                      src={user?.avatar || 'https://via.placeholder.com/32'}
                      alt={(user as any)?.username || user?.name}
                      className="h-8 w-8 rounded-full ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-200"
                    />
                    {/* Network Status */}
                    <span className={`absolute top-0 right-0 h-2 w-2 rounded-full border border-background ${
                      isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    {/* Studying Status */}
                    {studying && (
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-blue-600 border border-background"></span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
