import type { SessionState } from '../../types';
import { cn } from '../../lib/utils';

interface StatusDotProps {
  state: SessionState;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
} as const;

const pingSizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
} as const;

/**
 * Maps each SessionState to its visual configuration.
 *
 * - active:   gold dot + emerald green ping animation  (Req 17.43, 17.44, 17.45)
 * - on-break: static amber/orange                      (Req 17.46)
 * - away:     static muted gray                        (Req 17.47)
 * - offline:  very faint muted                         (Req 17.47)
 */
export const stateStyles: Record<SessionState, { dot: string; pulse: boolean }> = {
  active: {
    dot: 'bg-[hsl(var(--state-active))]',
    pulse: true,
  },
  'on-break': {
    dot: 'bg-[hsl(var(--state-break))]',
    pulse: false,
  },
  away: {
    dot: 'bg-[hsl(var(--state-away))]',
    pulse: false,
  },
  offline: {
    dot: 'bg-[hsl(var(--state-offline))]',
    pulse: false,
  },
};

export function StatusDot({ state, size = 'md' }: StatusDotProps) {
  const { dot, pulse } = stateStyles[state];

  return (
    <span
      className="relative inline-flex"
      role="status"
      aria-label={`Status: ${state}`}
    >
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex rounded-full opacity-75 animate-ping',
            'bg-[hsl(var(--state-active-pulse))]',
            pingSizeClasses[size],
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeClasses[size],
          dot,
        )}
      />
    </span>
  );
}
