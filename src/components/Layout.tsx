import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { userAtom, studyingAtom } from '@/store/atoms';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Trophy,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from './ui/button';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { apiFetch } from '@/config/api';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/notices', icon: Bell, label: 'Notices' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [user] = useAtom(userAtom);
  const [studying] = useAtom(studyingAtom);
  const location = useLocation();

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
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
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {studying && (
              <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-green-600/10 text-green-600">
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
            <div className="text-right">
              <p className="text-sm font-medium">
                {(user as any)?.username ? `@${(user as any).username}` : user?.name}
              </p>
              <p className="text-xs text-muted-foreground">{user?.totalPoints} points</p>
            </div>
            <div className="relative">
              <img
                src={user?.avatar || 'https://via.placeholder.com/32'}
                alt={(user as any)?.username || user?.name}
                className="h-8 w-8 rounded-full"
              />
              {studying && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-600 border-2 border-background"></span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
