import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button, Tooltip, TooltipTrigger, TooltipContent } from '@heroui/react';

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
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="relative rounded-lg p-2 text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
    </header>
  );
}
