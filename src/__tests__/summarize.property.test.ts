import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { summarizeForAI, truncateRecords } from '../lib/summarize';
import type { AttendanceRecord, UserProfile, DailyReport, TodoItem } from '../types';

/**
 * Feature: production-hosting-readiness
 * Property-based tests for AI context summarization and dataset truncation.
 */

// --- Generators ---

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

const validTimestampMs = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2029-12-31T23:59:59Z').getTime(),
});

const attendanceRecordArb: fc.Arbitrary<AttendanceRecord> = fc
  .record({
    uid: fc.string({ minLength: 1, maxLength: 10 }),
    date: validDateStr,
    checkInMs: validTimestampMs,
    durationMs: fc.integer({ min: 1, max: 12 * 60 * 60 * 1000 }),
    totalHours: fc.double({ min: 0, max: 12, noNaN: true }),
    status: fc.constantFrom('present' as const, 'wfh' as const),
  })
  .map((base) => ({
    uid: base.uid,
    date: base.date,
    checkInTime: new Date(base.checkInMs),
    checkOutTime: new Date(base.checkInMs + base.durationMs),
    totalHours: base.totalHours,
    status: base.status,
  }));

const userProfileArb: fc.Arbitrary<UserProfile> = fc.record({
  uid: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  email: fc.string({ minLength: 5, maxLength: 30 }),
  role: fc.constantFrom('admin' as const, 'employee' as const, 'intern' as const),
});

const todoItemArb: fc.Arbitrary<TodoItem> = fc.record({
  task: fc.string({ minLength: 1, maxLength: 20 }),
  completed: fc.boolean(),
});

const dailyReportArb: fc.Arbitrary<DailyReport> = fc.record({
  uid: fc.string({ minLength: 1, maxLength: 10 }),
  date: validDateStr,
  todoList: fc.array(todoItemArb, { minLength: 0, maxLength: 5 }),
});

// --- Property 8: AI context summarization reduces payload size ---

describe('Feature: production-hosting-readiness, Property 8: AI context summarization reduces payload size', () => {
  /**
   * **Validates: Requirements 12.1, 12.2**
   *
   * For any dataset containing users, attendance records, and daily reports,
   * the summarizeForAI function SHALL produce a payload that contains the required
   * summary fields (totalUsers, totalAttendanceRecords, avgHours, taskCompletionRate)
   * and the serialized summary SHALL be smaller than or equal to the serialized raw dataset.
   */
  it('should produce a summary with required fields that is <= raw dataset size', () => {
    fc.assert(
      fc.property(
        fc.array(userProfileArb, { minLength: 1, maxLength: 20 }),
        fc.array(attendanceRecordArb, { minLength: 1, maxLength: 100 }),
        fc.array(dailyReportArb, { minLength: 1, maxLength: 20 }),
        (users, attendance, reports) => {
          const summary = summarizeForAI(users, attendance, reports);

          // Summary must contain required fields
          expect(summary).toHaveProperty('totalUsers');
          expect(summary).toHaveProperty('totalAttendanceRecords');
          expect(summary).toHaveProperty('avgHours');
          expect(summary).toHaveProperty('taskCompletionRate');
          expect(summary).toHaveProperty('recentRecords');

          // totalUsers and totalAttendanceRecords must match input counts
          expect(summary.totalUsers).toBe(users.length);
          expect(summary.totalAttendanceRecords).toBe(attendance.length);

          // avgHours and taskCompletionRate must be finite numbers
          expect(Number.isFinite(summary.avgHours)).toBe(true);
          expect(Number.isFinite(summary.taskCompletionRate)).toBe(true);

          // Serialized summary must be <= serialized raw dataset
          const rawPayload = JSON.stringify({ users, attendance, reports });
          const summaryPayload = JSON.stringify(summary);
          expect(summaryPayload.length).toBeLessThanOrEqual(rawPayload.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 9: Dataset truncation to 50 records ---

describe('Feature: production-hosting-readiness, Property 9: Dataset truncation to 50 records', () => {
  /**
   * **Validates: Requirements 12.3**
   *
   * For any array of records with length > 50, the truncation function SHALL return
   * exactly 50 records, and those records SHALL be the 50 most recent (by date, descending).
   */
  it('should return exactly 50 records when input exceeds 50', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceRecordArb, { minLength: 51, maxLength: 150 }),
        (records) => {
          const result = truncateRecords(records, 50);
          expect(result).toHaveLength(50);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return the 50 most recent records by date descending', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceRecordArb, { minLength: 51, maxLength: 150 }),
        (records) => {
          const result = truncateRecords(records, 50);

          // Sort the original records by date descending and take first 50
          const sortedAll = [...records].sort((a, b) => {
            if (a.date > b.date) return -1;
            if (a.date < b.date) return 1;
            return 0;
          });
          const expected = sortedAll.slice(0, 50);

          // The result dates should match the expected dates
          const resultDates = result.map((r) => r.date);
          const expectedDates = expected.map((r) => r.date);
          expect(resultDates).toEqual(expectedDates);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return all records unchanged when length <= 50', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const result = truncateRecords(records, 50);
          expect(result).toHaveLength(records.length);
          // Should be the same array reference when no truncation needed
          expect(result).toBe(records);
        },
      ),
      { numRuns: 100 },
    );
  });
});
