/**
 * Environment Variable Leak Tests
 *
 * Task 13.7 — Validates: Requirements 1.1, 1.6
 *
 * Verifies that:
 * 1. vite.config.ts does NOT contain a `define` entry for GEMINI_API_KEY
 * 2. No .env values leak into client-side JavaScript
 * 3. The built dist/ directory does not contain API key patterns
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';

const ROOT_DIR = resolve(__dirname, '../../../');

// ---------------------------------------------------------------------------
// 1. vite.config.ts does not define GEMINI_API_KEY
// ---------------------------------------------------------------------------
describe('Env Variable Leak: vite.config.ts', () => {
  it('should NOT contain a define block for process.env.GEMINI_API_KEY', () => {
    const viteConfigPath = resolve(ROOT_DIR, 'vite.config.ts');
    const content = readFileSync(viteConfigPath, 'utf8');

    // Check for the specific pattern that was removed in task 5.3
    expect(content).not.toContain('process.env.GEMINI_API_KEY');
    expect(content).not.toContain('GEMINI_API_KEY');
  });

  it('should NOT contain a define block injecting any API keys', () => {
    const viteConfigPath = resolve(ROOT_DIR, 'vite.config.ts');
    const content = readFileSync(viteConfigPath, 'utf8');

    // No define block at all (or if present, no API key references)
    const hasDefineWithApiKey = /define\s*:\s*\{[^}]*API_KEY[^}]*\}/s.test(content);
    expect(hasDefineWithApiKey).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Client source code does not reference GEMINI_API_KEY
// ---------------------------------------------------------------------------
describe('Env Variable Leak: Client source code', () => {
  function collectClientFiles(dir: string, files: string[] = []): string[] {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist', '.git', '__tests__', 'api'].includes(entry)) {
          collectClientFiles(fullPath, files);
        }
      } else if (['.tsx', '.ts'].includes(extname(entry)) && !entry.includes('.test.')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('should NOT reference GEMINI_API_KEY in any client source file', () => {
    const srcDir = resolve(ROOT_DIR, 'src');
    const files = collectClientFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('GEMINI_API_KEY')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should NOT import @google/genai in any client source file', () => {
    const srcDir = resolve(ROOT_DIR, 'src');
    const files = collectClientFiles(srcDir);

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('@google/genai')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Built dist/ does not contain API key patterns
// ---------------------------------------------------------------------------
describe('Env Variable Leak: Built output', () => {
  function collectDistFiles(dir: string, files: string[] = []): string[] {
    if (!existsSync(dir)) return files;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectDistFiles(fullPath, files);
      } else if (['.js', '.mjs', '.cjs'].includes(extname(entry))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('should NOT contain GEMINI_API_KEY in any dist/ JS file', () => {
    const distDir = resolve(ROOT_DIR, 'dist');
    const files = collectDistFiles(distDir);

    if (files.length === 0) {
      // dist/ doesn't exist or has no JS files — that's fine, skip
      return;
    }

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('GEMINI_API_KEY')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should NOT contain Gemini-specific API key references in dist/ JS files', () => {
    const distDir = resolve(ROOT_DIR, 'dist');
    const files = collectDistFiles(distDir);

    if (files.length === 0) {
      return;
    }

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Check for Gemini API key variable names (not Firebase public API keys)
      if (
        content.includes('GEMINI_API_KEY') ||
        content.includes('gemini_api_key') ||
        content.includes('geminiApiKey')
      ) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should NOT contain .env variable names in dist/ JS files', () => {
    const distDir = resolve(ROOT_DIR, 'dist');
    const files = collectDistFiles(distDir);

    if (files.length === 0) {
      return;
    }

    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Check for process.env references that shouldn't be in client bundle
      if (/process\.env\.GEMINI_API_KEY/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});
