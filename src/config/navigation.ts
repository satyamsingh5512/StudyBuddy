import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Bell,
  Bot,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  FileText,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Newspaper,
  Settings,
  StickyNote,
  Target,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';

export interface NavLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  /** Stable id used to persist which sections the user keeps open. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Direct destination for sections that have no children. */
  path?: string;
  items?: NavLink[];
}

/**
 * Primary navigation is limited to six top-level buttons. Every page that used
 * to sit in the flat 17-item list is still reachable, grouped under the button
 * that owns its workflow, so the rail stays scannable at a glance.
 */
export const navSections: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    id: 'plan',
    label: 'Study Plan',
    icon: ListTodo,
    items: [
      { path: '/tasks', label: 'Tasks', icon: ListTodo },
      { path: '/goals', label: 'Goals', icon: Target },
      { path: '/show-up', label: 'Show Up', icon: CalendarCheck },
      { path: '/schedule', label: 'Schedule', icon: CalendarDays },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: TrendingUp,
    items: [
      { path: '/reports', label: 'Reports', icon: FileText },
      { path: '/achievements', label: 'Achievements', icon: Award },
      { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Bot,
    items: [
      { path: '/mentor', label: 'Mentor', icon: Bot },
      { path: '/journal', label: 'Journal', icon: BookOpen },
      { path: '/notes', label: 'Notepad', icon: StickyNote },
    ],
  },
  {
    id: 'community',
    label: 'Community',
    icon: MessageSquare,
    items: [
      { path: '/friends', label: 'Friends', icon: User },
      { path: '/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    id: 'updates',
    label: 'Updates',
    icon: Newspaper,
    items: [
      { path: '/news', label: 'News', icon: Newspaper },
      { path: '/notices', label: 'Notices', icon: Bell },
    ],
  },
];

/** Utility destinations live in the sidebar footer, not the main button list. */
export const navUtilityLinks: NavLink[] = [
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help', icon: CircleHelp },
];

/** Section that owns a pathname, used to auto-open and highlight on navigation. */
export function findSectionForPath(pathname: string): NavSection | undefined {
  return navSections.find(
    (section) =>
      (section.path && isPathActive(pathname, section.path)) ||
      section.items?.some((item) => isPathActive(pathname, item.path))
  );
}

export function isPathActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}
