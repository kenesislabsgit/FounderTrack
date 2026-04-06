import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeAvgShiftDuration,
  computeOnTimePercentage,
  computeAvgTaskCompletionRate,
  computeLeaveBalance,
  computeShiftProgress,
} from '../services/statsService';
import type { AttendanceRecord, DailyReport, LeaveRequest, TodoItem } from '../types';

/**
 * Feature: production-hosting-readiness
 * Property-based tests for statsService pure functions.
 */

// --- Generators ---

/** Generate a valid timestamp (ms) in a reasonable range. */
const validTimestampMs = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2029-12-31T23:59:59Z').getTime(),
});

/** Generate a valid date string YYYY-MM-DD. */
const validDateStr = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  });

/** Generate a valid AttendanceRecord with both checkIn and checkOut timestamps. */
const attendanceWithBothTimestamps: fc.Arbitrary<AttendanceRecord> = fc
  .record({
    uid: fc.string({ minLength: 1, maxLength: 20 }),
    date: validDateStr,
    checkInMs: validTimestampMs,
    durationMs: fc.integer({ min: 1, max: 24 * 60 * 60 * 1000 }), // 1ms to 24h
    status: fc.constantFrom('present' as const, 'wfh' as const),
  })
  .map((base) => ({
    uid: base.uid,
    date: base.date,
    checkInTime: new Date(base.checkInMs),
    checkOutTime: new Date(base.checkInMs + base.durationMs),
    status: base.status,
  }));

/** Generate an AttendanceRecord with a checkInTime (checkOut may or may not exist). */
const attendanceWithCheckIn: fc.Arbitrary<AttendanceRecord> = validTimestampMs.map((ms) => ({
  uid: 'user1',
  date: '2025-01-01',
  checkInTime: new Date(ms),
  status: 'present' as const,
}));

/** Generate a TodoItem. */
const todoItemArb: fc.Arbitrary<TodoItem> = fc.record({
  task: fc.string({ minLength: 1, maxLength: 50 }),
  completed: fc.boolean(),
});

/** Generate a DailyReport with at least one todoList entry. */
const dailyReportWithTodos: fc.Arbitrary<DailyReport> = fc.record({
  uid: fc.string({ minLength: 1, maxLength: 20 }),
  date: validDateStr,
  todoList: fc.array(todoItemArb, { minLength: 1, maxLength: 20 }),
});

/** Generate a LeaveRequest. */
const leaveRequestArb: fc.Arbitrary<LeaveRequest> = fc.record({
  uid: fc.string({ minLength: 1, maxLength: 20 }),
  startDate: fc
    .integer({ min: 2020, max: 2030 })
    .chain((year) =>
      fc.integer({ min: 1, max: 12 }).chain((month) =>
        fc.integer({ min: 1, max: 28 }).map((day) => {
          const m = String(month).padStart(2, '0');
          const d = String(day).padStart(2, '0');
          return `${year}-${m}-${d}`;
        }),
      ),
    ),
  endDate: fc.constant('2025-12-31'),
  reason: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('leave' as const, 'wfh' as const),
  status: fc.constantFrom('pending' as const, 'approved' as const, 'rejected' as const),
});

// --- Property Tests ---

describe('Feature: production-hosting-readiness, Property 2: Average shift duration is correct', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any non-empty array of AttendanceRecord with both timestamps,
   * computeAvgShiftDuration returns sum of durations / count.
   */
  it('should equal sum of individual durations divided by count', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceWithBothTimestamps, { minLength: 1, maxLength: 50 }),
        (records) => {
          const result = computeAvgShiftDuration(records);

          // Manually compute expected value
          let totalMs = 0;
          let count = 0;
          for (const r of records) {
            const checkIn = r.checkInTime instanceof Date ? r.checkInTime : new Date(r.checkInTime);
            const checkOut = r.checkOutTime instanceof Date ? r.checkOutTime : new Date(r.checkOutTime);
            totalMs += checkOut.getTime() - checkIn.getTime();
            count++;
          }
          const expected = totalMs / count / (1000 * 60 * 60);

          expect(result).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: production-hosting-readiness, Property 3: On-time arrival percentage is correct', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any non-empty array with checkInTime values and valid expected start hour (0-23),
   * computeOnTimePercentage returns (onTime/total)*100, always 0-100.
   */
  it('should return a value between 0 and 100 equal to (onTime/total)*100', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceWithCheckIn, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 23 }),
        (records, expectedStartHour) => {
          const result = computeOnTimePercentage(records, expectedStartHour);

          // Result must be in [0, 100]
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);

          // Manually compute expected
          let onTime = 0;
          let total = 0;
          for (const r of records) {
            const checkIn = r.checkInTime instanceof Date ? r.checkInTime : new Date(r.checkInTime);
            total++;
            const hours = checkIn.getHours();
            const minutes = checkIn.getMinutes();
            const seconds = checkIn.getSeconds();
            const ms = checkIn.getMilliseconds();
            if (
              hours < expectedStartHour ||
              (hours === expectedStartHour && minutes === 0 && seconds === 0 && ms === 0)
            ) {
              onTime++;
            }
          }
          const expected = (onTime / total) * 100;
          expect(result).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: production-hosting-readiness, Property 4: Task completion rate is correct', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any non-empty array of DailyReport with todoList entries,
   * computeAvgTaskCompletionRate returns (completed/total)*100, always 0-100.
   */
  it('should return a value between 0 and 100 equal to (completed/total)*100', () => {
    fc.assert(
      fc.property(
        fc.array(dailyReportWithTodos, { minLength: 1, maxLength: 50 }),
        (reports) => {
          const result = computeAvgTaskCompletionRate(reports);

          // Result must be in [0, 100]
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);

          // Manually compute expected
          let totalCompleted = 0;
          let totalTasks = 0;
          for (const report of reports) {
            if (report.todoList) {
              for (const item of report.todoList) {
                totalTasks++;
                if (item.completed) totalCompleted++;
              }
            }
          }
          const expected = totalTasks === 0 ? 0 : (totalCompleted / totalTasks) * 100;
          expect(result).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: production-hosting-readiness, Property 5: Leave/WFH balance computation', () => {
  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * For any array of LeaveRequest, type filter, year, and allowance,
   * computeLeaveBalance returns correct used count and total=allowance.
   */
  it('should return used count of approved+matching requests and total=allowance', () => {
    fc.assert(
      fc.property(
        fc.array(leaveRequestArb, { minLength: 0, maxLength: 50 }),
        fc.constantFrom('leave' as const, 'wfh' as const),
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 0, max: 100 }),
        (leaves, type, year, allowance) => {
          const result = computeLeaveBalance(leaves, type, year, allowance);

          // total must equal allowance
          expect(result.total).toBe(allowance);

          // Manually compute expected used
          let expectedUsed = 0;
          for (const leave of leaves) {
            if (
              leave.status === 'approved' &&
              leave.type === type &&
              leave.startDate &&
              new Date(leave.startDate).getFullYear() === year
            ) {
              expectedUsed++;
            }
          }
          expect(result.used).toBe(expectedUsed);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: production-hosting-readiness, Property 6: Shift progress computation with cap', () => {
  /**
   * **Validates: Requirements 6.1, 6.3**
   *
   * For any valid checkInTime and positive expected duration,
   * computeShiftProgress returns min(100, elapsed/expected*100), always 0-100.
   */
  it('should return a value between 0 and 100, capped at 100', () => {
    fc.assert(
      fc.property(
        validTimestampMs.map((ms) => new Date(ms)),
        fc.double({ min: 0.01, max: 24, noNaN: true }),
        (checkInTime, expectedDurationHours) => {
          const result = computeShiftProgress(checkInTime, expectedDurationHours);

          // Result must always be in [0, 100]
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should equal min(100, elapsed/expected*100) for a known now', () => {
    // Use a deterministic test: checkIn = 4 hours ago, expected = 8 hours → 50%
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const result = computeShiftProgress(fourHoursAgo, 8);
    // Allow small tolerance due to execution time
    expect(result).toBeGreaterThan(49);
    expect(result).toBeLessThan(51);
  });
});
