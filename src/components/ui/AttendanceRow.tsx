import { format } from 'date-fns';
import { cn } from '../../lib/utils';

export interface AttendanceRowProps {
  /** The attendance date string (YYYY-MM-DD) */
  date: string;
  /** Employee name — shown when isAdmin is true */
  employeeName?: string;
  /** Whether to show the employee name column */
  showEmployee?: boolean;
  /** Check-in timestamp — ISO string or Date from Supabase */
  checkInTime?: Date | string | null;
  /** Check-out timestamp — ISO string or Date from Supabase */
  checkOutTime?: Date | string | null;
  /** Pre-computed total hours for the shift */
  totalHours?: number;
  /** Attendance status */
  status: 'present' | 'wfh' | 'leave';
  /** Additional className for the row */
  className?: string;
}

const statusStyles: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  wfh: 'bg-blue-100 text-blue-700',
  leave: 'bg-yellow-100 text-yellow-700',
};

function formatTime(timestamp: Date | string | null | undefined): string {
  if (timestamp == null) return '—'; // handles both null and undefined

  let date: Date;

  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Legacy object shape (Firestore-style): { seconds: number, nanoseconds: number }
    const ts = timestamp as unknown as Record<string, unknown>;
    if (typeof ts['seconds'] === 'number') {
      date = new Date(ts['seconds'] as number * 1000);
    } else if (typeof (ts as any).toDate === 'function') {
      date = (ts as any).toDate();
    } else {
      date = new Date(String(timestamp));
    }
  }

  if (isNaN(date.getTime())) return '—';
  return format(date, 'hh:mm a');
}

export function AttendanceRow({
  date,
  employeeName,
  showEmployee = false,
  checkInTime,
  checkOutTime,
  totalHours,
  status,
  className,
}: AttendanceRowProps) {
  return (
    <tr
      className={cn(
        'border-b border-gray-50 hover:bg-gray-50/50 transition-colors',
        className,
      )}
    >
      <td className="px-6 py-4 text-sm font-medium text-gray-900">{date}</td>
      {showEmployee && (
        <td className="px-6 py-4 text-sm text-gray-600">
          {employeeName || 'Unknown'}
        </td>
      )}
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatTime(checkInTime)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatTime(checkOutTime)}
      </td>
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {totalHours != null ? `${totalHours.toFixed(1)}h` : '—'}
      </td>
      <td className="px-6 py-4">
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
            statusStyles[status] ?? statusStyles.present,
          )}
        >
          {status}
        </span>
      </td>
    </tr>
  );
}
