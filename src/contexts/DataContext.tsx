import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuthContext } from './AuthContext';
import { subscribeToTable } from '../lib/supabase';
import { AttendanceRecord, DailyReport, UserProfile } from '../types';
import { 
  mapAttendanceDbToRecord, 
  mapReportDbToRecord, 
  mapUserDbToProfile 
} from '../services/dataService';

interface DataContextType {
  attendance: AttendanceRecord[];
  reports: DailyReport[];
  users: UserProfile[];
  loading: boolean;
  // Stats helpers to prevent redundant re-computations in components
  stats: {
    todayRecord: AttendanceRecord | null;
    todayReport: DailyReport | null;
    userAttendance: AttendanceRecord[];
    userReports: DailyReport[];
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuthContext();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingStates, setLoadingStates] = useState({
    attendance: true,
    reports: true,
    users: true,
  });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Global Subscriptions (Once per App Lifecycle)
  useEffect(() => {
    if (!user) return;

    // Admin sees everything, users see only their own data (RLS also enforces this)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';

    const unsubUsers = subscribeToTable<any>(
      'users', 
      {}, 
      (data) => {
        setUsers(data.map(mapUserDbToProfile));
        setLoadingStates(prev => ({ ...prev, users: false }));
      }
    );

    const unsubAttendance = subscribeToTable<any>(
      'attendance',
      isAdmin ? {} : { filters: [{ column: 'uid', value: user.uid }] },
      (data) => {
        setAttendance(data.map(mapAttendanceDbToRecord));
        setLoadingStates(prev => ({ ...prev, attendance: false }));
      }
    );

    const unsubReports = subscribeToTable<any>(
      'daily_reports',
      isAdmin ? {} : { filters: [{ column: 'uid', value: user.uid }] },
      (data) => {
        setReports(data.map(mapReportDbToRecord));
        setLoadingStates(prev => ({ ...prev, reports: false }));
      }
    );

    return () => {
      unsubUsers();
      unsubAttendance();
      unsubReports();
    };
  }, [user, profile?.role]);

  // 2. Compute common derivatives once for all components
  const stats = useMemo(() => {
    const userAttendance = user ? attendance.filter(a => a.uid === user.uid) : [];
    const userReports = user ? reports.filter(r => r.uid === user.uid) : [];
    const todayRecord = userAttendance.find(a => a.date === today) || null;
    const todayReport = userReports.find(r => r.date === today) || null;

    return {
      todayRecord,
      todayReport,
      userAttendance,
      userReports,
    };
  }, [attendance, reports, user, today]);

  const value = {
    attendance,
    reports,
    users,
    loading: loadingStates.attendance || loadingStates.reports || loadingStates.users,
    stats,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
