import { useLocation } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { Activity } from 'lucide-react';

/**
 * Route-to-title mapping.
 * Requirement 7.1: Remove decorative search bar.
 * Requirement 13.1: Fix "Team Management" title for team-management route.
 */
const routeTitles: Record<string, string> = {
  '/dashboard': 'My Dashboard',
  '/attendance': 'Attendance Log',
  '/leaves': 'Leave & WFH',
  '/reports': 'Daily Reports',
  '/analytics': 'Team Analytics',
  '/bot': 'AI Analytics Bot',
  '/brainstorm': 'Kenesis Brainstorm',
  '/team-management': 'Team Management',
  '/chopping-block': 'The Chopping Block',
  '/settings': 'Settings',
};

export function Header() {
  const { pathname } = useLocation();
  const { loading } = useData();
  const title = routeTitles[pathname] || 'FounderTrack';

  return (
    <header className="flex items-center justify-between bg-transparent px-6 py-5 relative">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-extrabold text-[hsl(var(--text-primary))] font-heading">
          {title}
        </h1>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[hsla(var(--bg-elevated),0.4)] border border-[hsl(var(--border-subtle))]/10 backdrop-blur-sm">
          {loading ? (
            <Activity size={10} className="text-amber-500 animate-pulse" />
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">
            {loading ? 'Syncing...' : 'Realtime'}
          </span>
        </div>
      </div>
      <div className="absolute bottom-0 left-6 right-6 accent-divider" />
    </header>
  );
}
