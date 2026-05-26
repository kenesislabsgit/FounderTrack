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
    <header className="flex items-center justify-between bg-transparent px-6 py-5 relative">
      <h1 className="text-xl font-extrabold text-[hsl(var(--text-primary))] font-heading">
        {title}
      </h1>
      <div className="absolute bottom-0 left-6 right-6 accent-divider" />
    </header>
  );
}
