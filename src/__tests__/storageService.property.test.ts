import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: production-hosting-readiness, Property 1: Storage path follows convention
 *
 * **Validates: Requirements 2.1**
 *
 * For any valid uid, date (YYYY-MM-DD), and filename,
 * uploadCheckInPhoto constructs path `check-in-photos/{uid}/{date}/{filename}`.
 *
 * Since uploadCheckInPhoto calls Firebase Storage (side effect), we mock
 * Firebase Storage and verify the path passed to `ref()`.
 */

// Mock firebase/storage before importing the module
const mockRef = vi.fn();
const mockUploadBytes = vi.fn().mockResolvedValue({});
const mockGetDownloadURL = vi.fn().mockResolvedValue('https://example.com/photo.jpg');
const mockGetStorage = vi.fn().mockReturnValue({});

vi.mock('firebase/storage', () => ({
  getStorage: () => mockGetStorage(),
  ref: (...args: any[]) => mockRef(...args),
  uploadBytes: (...args: any[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: any[]) => mockGetDownloadURL(...args),
}));

import { buildCheckInPhotoPath } from '../services/storageService';

// --- Generators ---

/** Generate a valid uid (alphanumeric, 1-28 chars like Firebase UIDs). */
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
  it('should construct path matching check-in-photos/{uid}/{date}/{filename}', () => {
    fc.assert(
      fc.property(uidArb, dateArb, filenameArb, (uid, date, filename) => {
        const path = buildCheckInPhotoPath(uid, date, filename);

        // Path must match the exact convention
        expect(path).toBe(`check-in-photos/${uid}/${date}/${filename}`);

        // Path must start with the correct prefix
        expect(path.startsWith('check-in-photos/')).toBe(true);

        // Path must contain exactly 3 slashes (4 segments)
        const segments = path.split('/');
        expect(segments).toHaveLength(4);
        expect(segments[0]).toBe('check-in-photos');
        expect(segments[1]).toBe(uid);
        expect(segments[2]).toBe(date);
        expect(segments[3]).toBe(filename);

        // Date segment must match YYYY-MM-DD pattern
        expect(segments[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }),
      { numRuns: 100 },
    );
  });
});
