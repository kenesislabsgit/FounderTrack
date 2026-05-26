import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Supabase Access Token
  try {
    await verifyToken(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Validate request body
  const { message, summary } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // 3. Call Gemini API using server-side key
  if (!GEMINI_API_KEY) {
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const contextPrompt = summary
      ? `You are an AI assistant for FounderTrack, a workspace management platform. Here is the current data summary:
- Total Users: ${summary.totalUsers}
- Total Attendance Records: ${summary.totalAttendanceRecords}
- Average Hours: ${summary.avgHours}
- Task Completion Rate: ${summary.taskCompletionRate}%
${summary.recentRecords ? `- Recent Records: ${JSON.stringify(summary.recentRecords)}` : ''}

User question: ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contextPrompt,
    });

    return res.status(200).json({ text: response.text || '' });
  } catch {
    return res.status(502).json({ error: 'AI service unavailable' });
  }
}
