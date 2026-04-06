import type { UserProfile, AttendanceRecord, DailyReport, AIChatRequest } from '../types';
import { computeAvgShiftDuration, computeAvgTaskCompletionRate } from '../services/statsService';

/**
 * Maximum number of attendance records to include in the AI summary.
 * Validates: Requirements 12.3
 */
export const MAX_RECENT_RECORDS = 50;

/**
 * Truncates an array of attendance records to the most recent N records,
 * sorted by date descending.
 *
 * Validates: Requirements 12.3
 */
export function truncateRecords(
  records: AttendanceRecord[],
  limit: number = MAX_RECENT_RECORDS,
): AttendanceRecord[] {
  if (records.length <= limit) return records;
  const sorted = [...records].sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return 0;
  });
  return sorted.slice(0, limit);
}

/**
 * Builds a summarized AI chat request payload from raw data.
 * Computes summary stats client-side and truncates attendance to most recent 50 records.
 *
 * Validates: Requirements 12.1, 12.2, 12.3
 */
export function summarizeForAI(
  users: UserProfile[],
  attendance: AttendanceRecord[],
  reports: DailyReport[],
): AIChatRequest['summary'] {
  const avgHours = computeAvgShiftDuration(attendance);
  const taskCompletionRate = computeAvgTaskCompletionRate(reports);
  const recentRecords = truncateRecords(attendance);

  return {
    totalUsers: users.length,
    totalAttendanceRecords: attendance.length,
    avgHours,
    taskCompletionRate,
    recentRecords,
  };
}
