import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  /** Card title label (e.g. "Total Records") */
  title: string;
  /** Primary display value (e.g. "8.4 hrs") */
  value: string | number;
  /** Optional subtitle text below the value */
  subtitle?: string;
  /** Icon element rendered in the colored icon box */
  icon?: ReactNode;
  /** Background color class for the icon container (e.g. "bg-blue-50") */
  iconBg?: string;
  /** Text color class for the icon (e.g. "text-blue-500") */
  iconColor?: string;
  /** Optional trend info (e.g. "+5%") */
  trend?: string;
  /** Whether the trend is positive, negative, or neutral */
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Additional className for the card container */
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-500',
  trend,
  trendDirection = 'neutral',
  className,
}: StatCardProps) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-green-500'
      : trendDirection === 'down'
        ? 'text-red-500'
        : 'text-[hsl(var(--text-muted))]';

  return (
    <div className={cn('glass rounded-2xl p-5', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              iconBg,
              iconColor,
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-black text-[hsl(var(--text-primary))]">{value}</p>
            {trend && (
              <span className={cn('text-xs font-semibold', trendColor)}>
                {trend}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
