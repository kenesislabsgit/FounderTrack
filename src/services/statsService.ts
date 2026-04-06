import type { AttendanceRecord, DailyReport, LeaveRequest } from '../types';

/**
 * Converts a value to a Date. Handles Firestore Timestamps (which have .toDate()),
 * plain Date objects, and numeric millisecond timestamps.
 */
function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  if (typeof value === 'number') return new Date(value);
  return null;
}

/**
 * Computes the average shift duration in hours from attendance records.
 * Only considers records that have both checkInTime and checkOutTime.
 * Returns 0 if no valid records exist.
 *
 * Validates: Requirements 3.1
 */
export function computeAvgShiftDuration(records: AttendanceRecord[]): number {
  let totalMs = 0;
  let count = 0;

  for (const record of records) {
    const checkIn = toDate(record.checkInTime);
    const checkOut = toDate(record.checkOutTime);
    if (checkIn && checkOut) {
      totalMs += checkOut.getTime() - checkIn.getTime();
      count++;
    }
  }

  if (count === 0) return 0;
  return totalMs / count / (1000 * 60 * 60);
}

/**
 * Computes the on-time arrival percentage.
 * A record is "on time" if its checkInTime hour is <= expectedStartHour.
 * Only considers records that have a checkInTime.
 * Returns 0 if no records have a checkInTime.
 * Result is always between 0 and 100 inclusive.
 *
 * Validates: Requirements 3.2
 */
export function computeOnTimePercentage(
  records: AttendanceRecord[],
  expectedStartHour: number,
): number {
  let onTime = 0;
  let total = 0;

  for (const record of records) {
    const checkIn = toDate(record.checkInTime);
    if (checkIn) {
      total++;
      if (checkIn.getHours() < expectedStartHour || 
          (checkIn.getHours() === expectedStartHour && checkIn.getMinutes() === 0 && checkIn.getSeconds() === 0 && checkIn.getMilliseconds() === 0)) {
        onTime++;
      }
    }
  }

  if (total === 0) return 0;
  return (onTime / total) * 100;
}


/**
 * Computes the average task completion rate across all daily reports.
 * Sums all completed tasks and divides by total tasks across all reports.
 * Returns 0 if there are no tasks at all.
 * Result is always between 0 and 100 inclusive.
 *
 * Validates: Requirements 4.1
 */
export function computeAvgTaskCompletionRate(reports: DailyReport[]): number {
  let totalCompleted = 0;
  let totalTasks = 0;

  for (const report of reports) {
    if (report.todoList) {
      for (const item of report.todoList) {
        totalTasks++;
        if (item.completed) {
          totalCompleted++;
        }
      }
    }
  }

  if (totalTasks === 0) return 0;
  return (totalCompleted / totalTasks) * 100;
}

/**
 * Computes the leave balance for a given type and year.
 * Counts approved requests matching the type whose startDate falls within the given year.
 * Returns { used, total } where used is the count and total is the allowance.
 *
 * Validates: Requirements 5.2, 5.3
 */
export function computeLeaveBalance(
  leaves: LeaveRequest[],
  type: 'leave' | 'wfh',
  year: number,
  allowance: number,
): { used: number; total: number } {
  let used = 0;

  for (const leave of leaves) {
    if (
      leave.status === 'approved' &&
      leave.type === type &&
      leave.startDate &&
      new Date(leave.startDate).getFullYear() === year
    ) {
      used++;
    }
  }

  return { used, total: allowance };
}

/**
 * Computes the current shift progress as a percentage.
 * Progress = min(100, (elapsed / expected) * 100).
 * Result is always between 0 and 100 inclusive.
 *
 * Validates: Requirements 6.1, 6.3
 */
export function computeShiftProgress(
  checkInTime: Date,
  expectedDurationHours: number,
): number {
  if (expectedDurationHours <= 0) return 100;

  const now = new Date();
  const elapsedMs = now.getTime() - checkInTime.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const progress = (elapsedHours / expectedDurationHours) * 100;

  return Math.min(100, Math.max(0, progress));
}
