import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function verifyToken(req: VercelRequest): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    throw new Error('UNAUTHORIZED');
  }
  return admin.auth().verifyIdToken(idToken);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Firebase ID token
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
