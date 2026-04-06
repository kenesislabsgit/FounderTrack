export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'founder' | 'admin' | 'employee' | 'intern';
  photoURL?: string;
  preferences?: {
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
}

export interface AttendanceRecord {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  checkInTime?: any; // Firestore Timestamp
  checkOutTime?: any; // Firestore Timestamp
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  checkInPhoto?: string;
  checkOutPhoto?: string;
  totalHours?: number;
  status: 'present' | 'wfh' | 'leave';
}

export interface TodoItem {
  task: string;
  completed: boolean;
}

export interface DailyReport {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  attendanceId?: string; // Link to specific shift
  reportUrl?: string;
  todoList?: TodoItem[];
}

export interface LeaveRequest {
  id?: string;
  uid: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'leave' | 'wfh';
  status: 'pending' | 'approved' | 'rejected';
}

export interface AppNotification {
  id?: string;
  uid: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
}

export interface BrainstormIdea {
  id?: string;
  uid: string;
  authorName: string;
  title: string;
  description: string;
  category: 'idea' | 'todo' | 'discussion';
  status: 'open' | 'in-progress' | 'completed' | 'archived';
  createdAt: any; // Firestore Timestamp
  upvotes: string[]; // List of UIDs
}

export interface ReviewCycle {
  id?: string;
  startDate: any;
  endDate: any;
  status: 'active' | 'voting' | 'completed';
  underperformerUid?: string;
  isTie?: boolean;
  tieBreakerUid?: string;
  results?: { [uid: string]: number }; // Average rank
}

export interface Ballot {
  id?: string;
  cycleId: string;
  voterUid: string;
  rankings: {
    targetUid: string;
    rank: number;
    reason: string;
  }[];
  createdAt: any;
}

export type SessionState = 'active' | 'on-break' | 'away' | 'offline';

export type Theme = 'dark' | 'light';

export interface AIChatRequest {
  message: string;
  summary: {
    totalUsers: number;
    totalAttendanceRecords: number;
    avgHours: number;
    taskCompletionRate: number;
    recentRecords: AttendanceRecord[]; // max 50
  };
}

export interface AIChatResponse {
  text: string;
}

export interface AIAnalyzeRequest {
  userData: Array<{
    uid: string;
    name: string;
    role: string;
    totalHours: number;
    completedTasks: number;
    totalTasks: number;
    completionRate: number;
  }>;
}
