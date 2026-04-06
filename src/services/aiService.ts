import { auth } from '../firebase';
import { AttendanceRecord, UserProfile, DailyReport } from '../types';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  role: string;
  totalHours: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  rank: number;
  contributionScore: number;
}

export interface AIAnalysisResult {
  leaderboard: LeaderboardEntry[];
  insights: string;
  topPerformer: string;
  summary: string;
}

async function getAuthToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('User is not authenticated');
  }
  return token;
}

export const AIService = {
  analyzePerformance: async (users: UserProfile[], attendance: AttendanceRecord[], reports: DailyReport[]): Promise<AIAnalysisResult> => {
    // Prepare data for AI
    const userData = users.map(user => {
      const userAttendance = attendance.filter(a => a.uid === user.uid);
      const userReports = reports.filter(r => r.uid === user.uid);

      const totalHours = userAttendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
      const totalTasks = userReports.reduce((acc, curr) => acc + (curr.todoList?.length || 0), 0);
      const completedTasks = userReports.reduce((acc, curr) => acc + (curr.todoList?.filter(t => t.completed).length || 0), 0);

      return {
        uid: user.uid,
        name: user.name,
        role: user.role,
        totalHours,
        completedTasks,
        totalTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      };
    });

    const token = await getAuthToken();

    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userData }),
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    return response.json();
  },

  chat: async (message: string, summary?: {
    totalUsers: number;
    totalAttendanceRecords: number;
    avgHours: number;
    taskCompletionRate: number;
    recentRecords?: AttendanceRecord[];
  }): Promise<string> => {
    const token = await getAuthToken();

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, summary }),
    });

    if (!response.ok) {
      throw new Error(`AI chat failed: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  },
};
