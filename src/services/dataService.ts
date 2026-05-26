import { supabase, subscribeToTable } from '../lib/supabase';
import { AttendanceRecord, UserProfile, DailyReport } from '../types';

// Helper mappers to translate from Postgres snake_case database schema to TypeScript camelCase model
export function mapUserDbToProfile(u: any): UserProfile {
  return {
    uid: u.uid,
    name: u.name,
    email: u.email,
    role: u.role,
    photoURL: u.photo_url || undefined,
    preferences: u.preferences || undefined,
  };
}

export function mapAttendanceDbToRecord(a: any): AttendanceRecord {
  return {
    id: a.id,
    uid: a.uid,
    date: a.date,
    checkInTime: a.check_in_time ? new Date(a.check_in_time) : undefined,
    checkOutTime: a.check_out_time ? new Date(a.check_out_time) : undefined,
    checkInLocation: a.check_in_location || undefined,
    checkOutLocation: a.check_out_location || undefined,
    checkInPhoto: a.check_in_photo || undefined,
    checkOutPhoto: a.check_out_photo || undefined,
    totalHours: a.total_hours ? Number(a.total_hours) : undefined,
    status: a.status,
  };
}

export function mapReportDbToRecord(r: any): DailyReport {
  return {
    id: r.id,
    uid: r.uid,
    date: r.date,
    attendanceId: r.attendance_id || undefined,
    reportUrl: r.report_url || undefined,
    todoList: r.todo_list || undefined,
  };
}

/**
 * DataService abstracts the data fetching logic using Supabase.
 */
export const DataService = {
  // Real-time listeners
  subscribeToAttendance: (uid: string, callback: (data: AttendanceRecord[]) => void) => {
    return subscribeToTable<any>(
      'attendance',
      {
        filters: [{ column: 'uid', value: uid }],
      },
      (data) => {
        callback(data.map(mapAttendanceDbToRecord));
      }
    );
  },

  subscribeToAllAttendance: (callback: (data: AttendanceRecord[]) => void) => {
    return subscribeToTable<any>(
      'attendance',
      {},
      (data) => {
        callback(data.map(mapAttendanceDbToRecord));
      }
    );
  },

  subscribeToAllReports: (callback: (data: DailyReport[]) => void) => {
    return subscribeToTable<any>(
      'daily_reports',
      {},
      (data) => {
        callback(data.map(mapReportDbToRecord));
      }
    );
  },

  subscribeToAllUsers: (callback: (data: UserProfile[]) => void) => {
    return subscribeToTable<any>(
      'users',
      {},
      (data) => {
        callback(data.map(mapUserDbToProfile));
      }
    );
  },

  // One-time fetches for AI analysis
  getAllDataForAnalysis: async () => {
    const [usersRes, attendanceRes, reportsRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('daily_reports').select('*'),
    ]);

    if (usersRes.error) console.error('Fetch users error:', usersRes.error.message);
    if (attendanceRes.error) console.error('Fetch attendance error:', attendanceRes.error.message);
    if (reportsRes.error) console.error('Fetch reports error:', reportsRes.error.message);

    const users = (usersRes.data || []).map(mapUserDbToProfile);
    const attendance = (attendanceRes.data || []).map(mapAttendanceDbToRecord);
    const reports = (reportsRes.data || []).map(mapReportDbToRecord);

    return { users, attendance, reports };
  },
};
