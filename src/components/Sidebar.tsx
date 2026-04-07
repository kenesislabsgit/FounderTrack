import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import {
  LayoutDashboard,
  Clock,
  FileText,
  Settings,
  LogOut,
  BarChart3,
  Plane,
  Bot,
  Lightbulb,
  Skull,
  Users,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';


interface SidebarProps {
  user: any;
  profile: any;
  onLogout: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
}

const coreItems: NavItem[] = [
  { path: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard, hideForAdmin: true },
  { path: '/team-management', label: 'Team Management', icon: Users, adminOnly: true },
  { path: '/brainstorm', label: 'Brainstorm', icon: Lightbulb },
  { path: '/chopping-block', label: 'Chopping Block', icon: Skull, adminOnly: true },
];

const teamOpsItems: NavItem[] = [
  { path: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { path: '/attendance', label: 'Attendance', icon: Clock },
  { path: '/leaves', label: 'Leave & WFH', icon: Plane },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/bot', label: 'AI Bot', icon: Bot, adminOnly: true },
];


function filterItems(items: NavItem[], role?: string): NavItem[] {
  return items.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false;
    if (item.hideForAdmin && role === 'admin') return false;
    return true;
  });
}

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
    isActive
      ? [
          'bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)]',
          'text-white',
          'shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]',
        ].join(' ')
      : 'text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] hover:text-[hsl(var(--text-primary))]',
  );

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">
        {label}
      </p>
      <nav aria-label={label} className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={navLinkClasses}
            onClick={onNavigate}
          >
            <item.icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar({ user, profile, onLogout }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const core = filterItems(coreItems, profile?.role);
  const teamOps = filterItems(teamOpsItems, profile?.role);

  const initials = user?.displayName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('') || 'U';

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex h-full w-[220px] flex-col bg-[hsl(var(--bg-sidebar))] border-r border-[hsl(var(--border-subtle))]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg font-bold text-lg',
            'bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)]',
            'text-white',
            'shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]',
          )}
        >
          K
        </div>
        <span className="text-base font-bold text-[hsl(var(--text-primary))]">
          Kenesis <span className="text-[hsl(var(--accent))]">Vision</span>
        </span>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <NavGroup label="Core" items={core} onNavigate={closeMobile} />
        {core.length > 0 && teamOps.length > 0 && (
          <hr className="accent-divider mx-2" />
        )}
        <NavGroup label="Team Ops" items={teamOps} onNavigate={closeMobile} />
      </div>

      {/* Bottom section */}
      <div className="border-t border-[hsl(var(--border-subtle))] px-3 py-3 space-y-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={navLinkClasses}
          onClick={closeMobile}
        >
          <Settings size={18} aria-hidden="true" />
          <span>Settings</span>
        </NavLink>

        {/* User section */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center text-xs font-bold overflow-hidden border border-[hsl(var(--border-default))] text-[hsl(var(--text-primary))]">
              {initials}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-[hsl(var(--text-primary))]">
              {user?.displayName || 'User'}
            </p>
            <p className="truncate text-[10px] text-[hsl(var(--text-muted))]">
              {profile?.role || 'employee'}
            </p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="rounded-lg p-1.5 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--danger))] transition-colors"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden rounded-lg p-1.5 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--danger))] transition-colors"
        aria-label="Open navigation"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobile}
          />
          <div className="relative h-full animate-slide-in-left">
            {sidebarContent}
            <button
              onClick={closeMobile}
              className="absolute top-4 right-[-44px] rounded-lg p-1.5 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--danger))] transition-colors"
              aria-label="Close navigation"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
