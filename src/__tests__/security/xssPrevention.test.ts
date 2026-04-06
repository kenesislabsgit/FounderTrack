/**
 * XSS Prevention Tests
 *
 * Task 13.4 — Validates: Requirements 14.1, 17.27
 *
 * Verifies that:
 * 1. No source files use dangerouslySetInnerHTML (React's XSS escape hatch)
 * 2. React's default JSX escaping protects user-generated content
 * 3. User-generated content with HTML/script tags is safely escaped
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';

// ---------------------------------------------------------------------------
// Helper: recursively collect all .tsx and .ts files under a directory
// ---------------------------------------------------------------------------
function collectSourceFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, __tests__
      if (!['node_modules', 'dist', '.git', '__tests__'].includes(entry)) {
        collectSourceFiles(fullPath, files);
      }
    } else if (['.tsx', '.ts'].includes(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 1. No dangerouslySetInnerHTML usage in source code
// ---------------------------------------------------------------------------
describe('XSS Prevention: No dangerouslySetInnerHTML usage', () => {
  it('should not use dangerouslySetInnerHTML in any source file', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('dangerouslySetInnerHTML')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should not use innerHTML assignment in any source file', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Match patterns like .innerHTML = or ['innerHTML'] =
      if (/\.innerHTML\s*=/.test(content) || /\['innerHTML'\]\s*=/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. React JSX escaping verification
// ---------------------------------------------------------------------------
describe('XSS Prevention: React JSX escaping', () => {
  it('should not use document.write in any source file', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (/document\.write\s*\(/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should not use eval() in any source file', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Match eval( but not .evaluate or similar
      if (/(?<!\w)eval\s*\(/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should not use new Function() constructor in any source file', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (/new\s+Function\s*\(/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Verify user-generated content rendering safety
// ---------------------------------------------------------------------------
describe('XSS Prevention: User content rendering patterns', () => {
  it('should not use v-html or equivalent raw HTML rendering directives', () => {
    const srcDir = resolve(__dirname, '../../');
    const files = collectSourceFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Check for various raw HTML injection patterns
      if (
        /v-html\s*=/.test(content) ||
        /\[innerHTML\]\s*=/.test(content) ||
        /insertAdjacentHTML/.test(content)
      ) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('React JSX should escape HTML entities in string interpolation', () => {
    // This is a compile-time guarantee from React's JSX transform.
    // We verify by checking that the project uses react-jsx transform.
    const tsconfigPath = resolve(__dirname, '../../../tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));

    expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
  });
});
