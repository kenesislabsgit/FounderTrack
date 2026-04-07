import { useLocation } from 'react-router-dom';

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
  const title = routeTitles[pathname] || 'FounderTrack';

  return (
    <header className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-6 py-4">
      <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">
        {title}
      </h1>
    </header>
  );
}
