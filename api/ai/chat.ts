import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Support both plain (server-side) and VITE_ prefixed (shared with frontend) env vars.
// In Vercel, add SUPABASE_URL and SUPABASE_ANON_KEY as plain env vars for the serverless runtime.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate critical env vars at cold-start to surface misconfiguration fast
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[chat] SUPABASE_URL or SUPABASE_ANON_KEY env var is missing!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Constants ────────────────────────────────────────────────────────────────
/** Max characters allowed in a single chat message to prevent cost abuse */
const MAX_MESSAGE_LENGTH = 10_000;
/** Max recent records to include in context to bound payload size */
const MAX_RECENT_RECORDS = 20;

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function verifyToken(req: VercelRequest): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    throw new Error('UNAUTHORIZED');
  }

  // Verify the user's Supabase access token (JWT)
  const { data: { user }, error } = await supabase.auth.getUser(idToken);
  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));
    return res.status(204).end();
  }

  // Set CORS headers on all responses
  Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Supabase Access Token
  try {
    await verifyToken(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Validate and sanitize request body
  const { message, summary } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid request: message string is required' });
  }

  // Guard against cost abuse via oversized messages
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message too long: max ${MAX_MESSAGE_LENGTH} characters allowed`,
    });
  }

  // 3. Call Gemini API using server-side key
  if (!GEMINI_API_KEY) {
    console.error('[chat] GEMINI_API_KEY is not set');
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Sanitize summary: cap recentRecords to avoid oversized context payloads
    const safeSummary = summary
      ? {
          ...summary,
          recentRecords: Array.isArray(summary.recentRecords)
            ? summary.recentRecords.slice(0, MAX_RECENT_RECORDS)
            : undefined,
        }
      : null;

    const contextPrompt = safeSummary
      ? `You are an AI assistant for FounderTrack, a workspace management platform. Here is the current data summary:
- Total Users: ${safeSummary.totalUsers}
- Total Attendance Records: ${safeSummary.totalAttendanceRecords}
- Average Hours: ${safeSummary.avgHours}
- Task Completion Rate: ${safeSummary.taskCompletionRate}%
${safeSummary.recentRecords ? `- Recent Records: ${JSON.stringify(safeSummary.recentRecords)}` : ''}

User question: ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contextPrompt,
    });

    return res.status(200).json({ text: response.text || '' });
  } catch (err) {
    console.error('[chat] Gemini API error:', err);
    return res.status(502).json({ error: 'AI service unavailable' });
  }
}
