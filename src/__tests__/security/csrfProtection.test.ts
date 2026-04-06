/**
 * CSRF Protection Verification Tests
 *
 * Task 13.5 — Validates: Requirements 1.3, 1.5
 *
 * Verifies that AI proxy endpoints require Firebase ID token authentication,
 * which acts as CSRF protection since:
 * - Tokens are not stored in cookies (not auto-sent by browsers)
 * - Tokens must be explicitly included in the Authorization header
 * - Cross-origin requests cannot obtain a valid Firebase ID token
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted setup
// ---------------------------------------------------------------------------
const { mockVerifyIdToken } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  return { mockVerifyIdToken: vi.fn() };
});

vi.mock('firebase-admin', () => {
  const apps: any[] = [];
  return {
    default: {
      apps,
      initializeApp: vi.fn(),
      auth: () => ({ verifyIdToken: mockVerifyIdToken }),
    },
    apps,
    initializeApp: vi.fn(),
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  };
});

// ---------------------------------------------------------------------------
// Mock @google/genai
// ---------------------------------------------------------------------------
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({ text: 'response' }),
    };
    constructor() {}
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
    },
  };
});

import chatHandler from '@/api/ai/chat';
import analyzeHandler from '@/api/ai/analyze';

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    method: 'POST',
    headers: {},
    body: {},
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// CSRF Protection: Chat endpoint
// ---------------------------------------------------------------------------
describe('CSRF Protection: /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without Authorization header', async () => {
    const req = createMockReq({
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should reject requests with empty Authorization header', async () => {
    const req = createMockReq({
      headers: { authorization: '' },
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should reject requests with non-Bearer auth scheme', async () => {
    const req = createMockReq({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should reject requests with invalid token (simulating cross-origin attack)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));

    const req = createMockReq({
      headers: { authorization: 'Bearer forged-csrf-token' },
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

// ---------------------------------------------------------------------------
// CSRF Protection: Analyze endpoint
// ---------------------------------------------------------------------------
describe('CSRF Protection: /api/ai/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without Authorization header', async () => {
    const req = createMockReq({
      body: { userData: [{ uid: 'u1', name: 'A', role: 'e', totalHours: 1, completedTasks: 1, totalTasks: 1, completionRate: 100 }] },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should reject requests with invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid'));

    const req = createMockReq({
      headers: { authorization: 'Bearer bad-token' },
      body: { userData: [{ uid: 'u1' }] },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

// ---------------------------------------------------------------------------
// Verify client-side code sends token in Authorization header
// ---------------------------------------------------------------------------
describe('CSRF Protection: Client-side token inclusion', () => {
  it('aiService.ts should include Authorization header in fetch calls', () => {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');

    const aiServicePath = resolve(__dirname, '../../services/aiService.ts');
    const content = readFileSync(aiServicePath, 'utf8');

    // Verify Authorization header is included in fetch calls
    expect(content).toContain('Authorization');
    expect(content).toContain('Bearer');

    // Verify it uses getIdToken (Firebase Auth token)
    expect(content).toContain('getIdToken');
  });
});
