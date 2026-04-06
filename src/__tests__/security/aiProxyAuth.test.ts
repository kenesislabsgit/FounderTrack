/**
 * AI Proxy Auth Token Verification Tests
 *
 * Task 13.3 — Validates: Requirements 1.3, 1.5
 *
 * Tests the chat and analyze serverless handlers directly by mocking
 * Firebase Admin SDK and Gemini SDK. Verifies that:
 * - Valid Firebase ID token → 200 with AI response
 * - Invalid token → 401
 * - Missing Authorization header → 401
 * - Malformed request body → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted setup: env vars + mock fns must be available before module load
// ---------------------------------------------------------------------------
const { mockVerifyIdToken, mockGenerateContent } = vi.hoisted(() => {
  // Set env vars at the earliest possible point (hoisted block runs first)
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.FIREBASE_PROJECT_ID = 'test-project';

  return {
    mockVerifyIdToken: vi.fn(),
    mockGenerateContent: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mock Firebase Admin SDK
// ---------------------------------------------------------------------------
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
// Mock @google/genai (Gemini SDK)
// ---------------------------------------------------------------------------
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
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

// ---------------------------------------------------------------------------
// Import handlers after mocks are set up
// ---------------------------------------------------------------------------
import chatHandler from '@/api/ai/chat';
import analyzeHandler from '@/api/ai/analyze';

// ---------------------------------------------------------------------------
// Helper: create mock VercelRequest / VercelResponse
// ---------------------------------------------------------------------------
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
// Tests for /api/ai/chat
// ---------------------------------------------------------------------------
describe('AI Proxy: /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 with AI response for valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mockGenerateContent.mockResolvedValue({ text: 'Hello from AI' });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token-123' },
      body: { message: 'Hello', summary: { totalUsers: 5, totalAttendanceRecords: 100, avgHours: 7.5, taskCompletionRate: 85 } },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ text: 'Hello from AI' });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token-123');
  });

  it('should return 401 for invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const req = createMockReq({
      headers: { authorization: 'Bearer bad-token' },
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 when Authorization header is missing', async () => {
    const req = createMockReq({
      headers: {},
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 for malformed Authorization header (no Bearer prefix)', async () => {
    const req = createMockReq({
      headers: { authorization: 'Token some-token' },
      body: { message: 'Hello' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 400 for malformed request body (missing message)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { notMessage: 'oops' },
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });

  it('should return 400 for empty body', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token' },
      body: null,
    });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });

  it('should return 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await chatHandler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});

// ---------------------------------------------------------------------------
// Tests for /api/ai/analyze
// ---------------------------------------------------------------------------
describe('AI Proxy: /api/ai/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 with analysis for valid token and data', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-1' });
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        leaderboard: [],
        insights: 'Great team',
        topPerformer: 'Alice',
        summary: 'All good',
      }),
    });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        userData: [
          { uid: 'u1', name: 'Alice', role: 'employee', totalHours: 40, completedTasks: 10, totalTasks: 12, completionRate: 83 },
        ],
      },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('insights');
  });

  it('should return 401 for missing Authorization header', async () => {
    const req = createMockReq({
      headers: {},
      body: { userData: [{ uid: 'u1' }] },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 for invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

    const req = createMockReq({
      headers: { authorization: 'Bearer expired-token' },
      body: { userData: [{ uid: 'u1' }] },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 400 for missing userData in body', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-1' });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { notUserData: 'oops' },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });

  it('should return 400 for empty userData array', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-1' });

    const req = createMockReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { userData: [] },
    });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });

  it('should return 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await analyzeHandler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});
