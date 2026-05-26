import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: production-hosting-readiness, Property 1: Storage path follows convention
 *
 * **Validates: Requirements 2.1**
 *
 * For any valid uid, date (YYYY-MM-DD), and filename,
 * uploadCheckInPhoto constructs path `{uid}/{date}/{filename}`.
 */

// Mock supabase client before importing
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
      }),
    },
  },
}));

import { buildCheckInPhotoPath } from '../services/storageService';

// --- Generators ---

/** Generate a valid uid (alphanumeric, 1-28 chars like UIDs). */
const uidArb = fc.stringMatching(/^[a-zA-Z0-9]{1,28}$/);

/** Generate a valid YYYY-MM-DD date string. */
const dateArb = fc
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

/** Generate a valid filename (alphanumeric with extension). */
const filenameArb = fc
  .record({
    name: fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
    ext: fc.constantFrom('.jpg', '.jpeg', '.png', '.webp'),
  })
  .map(({ name, ext }) => `${name}${ext}`);

describe('Feature: production-hosting-readiness, Property 1: Storage path follows convention', () => {
  /**
   * **Validates: Requirements 2.1**
   */
  it('should construct path matching {uid}/{date}/{filename}', () => {
    fc.assert(
      fc.property(uidArb, dateArb, filenameArb, (uid, date, filename) => {
        const path = buildCheckInPhotoPath(uid, date, filename);

        // Path must match the exact convention
        expect(path).toBe(`${uid}/${date}/${filename}`);

        // Path must contain exactly 2 slashes (3 segments)
        const segments = path.split('/');
        expect(segments).toHaveLength(3);
        expect(segments[0]).toBe(uid);
        expect(segments[1]).toBe(date);
        expect(segments[2]).toBe(filename);

        // Date segment must match YYYY-MM-DD pattern
        expect(segments[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }),
      { numRuns: 100 },
    );
  });
});
