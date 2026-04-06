import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
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
  const { userData } = req.body || {};
  if (!userData || !Array.isArray(userData) || userData.length === 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // 3. Call Gemini API using server-side key
  if (!GEMINI_API_KEY) {
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analyze the following employee performance data and generate a leaderboard and insights.
      Data: ${JSON.stringify(userData)}
      
      Requirements:
      1. Calculate a "Contribution Score" for each employee based on hours worked and task completion.
      2. Rank them.
      3. Provide a summary of who performed best and why.
      4. Provide general insights for the company.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leaderboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  uid: { type: Type.STRING },
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  totalHours: { type: Type.NUMBER },
                  completedTasks: { type: Type.NUMBER },
                  totalTasks: { type: Type.NUMBER },
                  completionRate: { type: Type.NUMBER },
                  rank: { type: Type.NUMBER },
                  contributionScore: { type: Type.NUMBER },
                },
                required: [
                  'uid', 'name', 'role', 'totalHours',
                  'completedTasks', 'totalTasks', 'completionRate',
                  'rank', 'contributionScore',
                ],
              },
            },
            insights: { type: Type.STRING },
            topPerformer: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ['leaderboard', 'insights', 'topPerformer', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json(parsed);
  } catch {
    return res.status(502).json({ error: 'AI service unavailable' });
  }
}
