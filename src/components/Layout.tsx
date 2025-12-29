import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useState } from 'react';
import { userAtom, studyingAtom } from '@/store/atoms';
import { useNetworkStatus } from '@/lib/networkStatus';
import {
  LayoutDashboard, Calendar, FileText, Trophy, Bell, MessageSquare,
  Settings, LogOut, User, ChevronDown, Menu, X, Sparkles, Users
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', gradient: 'from-violet-500 to-purple-600' },
  { path: '/schedule', icon: Calendar, label: 'Schedule', gradient: 'from-blue-500 to-cyan-500' },
  { path: '/reports', icon: FileText, label: 'Reports', gradient: 'from-emerald-500 to-teal-500' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', gradient: 'from-amber-500 to-orange-500' },
  { path: '/notices', icon: Bell, label: 'Notices', gradient: 'from-rose-500 to-pink-500' },
  { path: '/chat', icon: MessageSquare, label: 'Chat', gradient: 'from-indigo-500 to-violet-500' },
  { path: '/friends', icon: Users, label: 'Friends', gradient: 'from-fuchsia-500 to-pink-500' },
  { path: '/messages', icon: MessageSquare, label: 'Messages', gradient: 'from-cyan-500 to-blue-500' },
  { path: '/settings', icon: Settings, label: 'Settings', gradient: 'from-slate-500 to-gray-600' },
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
      <header className="md:hidden h-16 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-50" />
            <Logo className="w-8 h-8 relative" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            StudyBuddy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="h-10 w-10 p-0 rounded-xl">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-72 md:w-64 border-r border-border/50 flex flex-col
        bg-background/80 backdrop-blur-xl transform transition-transform duration-300 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-50" />
              <Logo className="w-9 h-9 relative" />
              {studying && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background">
                  <span className="animate-ping absolute inset-0 rounded-full bg-emerald-500 opacity-75" />
                </span>
              )}
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              StudyBuddy
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} className="md:hidden h-8 w-8 p-0 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User Profile - Mobile */}
        <div className="md:hidden p-4 border-b border-border/50">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur opacity-50" />
              <img src={user?.avatar || 'https://via.placeholder.com/40'} alt={user?.name}
                className="h-12 w-12 rounded-full ring-2 ring-violet-500/30 relative" />
              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{(user as any)?.username ? `@${(user as any).username}` : user?.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />{user?.totalPoints} points
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={handleNavClick}>
                  <div className={`
                    group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium
                    transition-all duration-300 ease-out overflow-hidden
                    ${isActive
                      ? 'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }
                  `}>
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
                    )}
                    
                    {/* Icon with gradient background on active */}
                    <div className={`
                      flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300
                      ${isActive 
                        ? `bg-gradient-to-br ${item.gradient} shadow-lg` 
                        : 'bg-muted/50 group-hover:bg-muted'
                      }
                    `}>
                      <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-white' : ''}`} />
                    </div>
                    
                    <span className="flex-1">{item.label}</span>
                    
                    {/* Hover effect */}
                    <div className={`
                      absolute inset-0 bg-gradient-to-r ${item.gradient} opacity-0 
                      group-hover:opacity-5 transition-opacity duration-300 rounded-2xl
                    `} />
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-border/50">
          <Button variant="ghost" onClick={handleLogout}
            className="w-full justify-start gap-3 h-12 rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/50">
              <LogOut className="h-4 w-4" />
            </div>
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 border-b border-border/50 items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {studying && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Studying</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-all duration-200 focus:outline-none group p-2 rounded-2xl hover:bg-accent/50">
                  <div className="text-right hidden lg:block">
                    <p className="text-sm font-semibold">{(user as any)?.username ? `@${(user as any).username}` : user?.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />{user?.totalPoints} points
                    </p>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur opacity-0 group-hover:opacity-50 transition-opacity" />
                    <img src={user?.avatar || 'https://via.placeholder.com/32'} alt={user?.name}
                      className="h-10 w-10 rounded-full ring-2 ring-border group-hover:ring-violet-500/50 transition-all duration-300 relative" />
                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl cursor-pointer">
                  <User className="mr-2 h-4 w-4" />Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="rounded-xl cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
