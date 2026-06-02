import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
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
  reports: DailyReport[]
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

  // Track which streams have delivered at least one payload.
  // Start as false only when user is present; otherwise skip loading state.
  const [loaded, setLoaded] = useState({ attendance: false, reports: false, users: false });

  // Keep a ref to the current role so we can restart subscriptions when it changes
  // without re-running the entire effect unnecessarily.
  const roleRef = useRef<string | undefined>(undefined);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Reset loaded state when user changes (login/logout)
  useEffect(() => {
    if (!user) {
      setAttendance([]);
      setReports([]);
      setUsers([]);
      setLoaded({ attendance: false, reports: false, users: false });
    }
  }, [user?.uid]);

  // 1. Global Subscriptions — restart when role changes (employee → admin promotion etc.)
  useEffect(() => {
    if (!user) return;

    const role = profile?.role;
    roleRef.current = role;

    // Admin and founder see all data; employees/interns only see their own (RLS also enforces this)
    const isAdmin = role === 'admin' || role === 'founder';

    const unsubUsers = subscribeToTable<any>(
      'users', 
      {}, 
      (data) => {
        setUsers(data.map(mapUserDbToProfile));
        setLoaded(prev => prev.users ? prev : { ...prev, users: true });
      }
    );

    const unsubAttendance = subscribeToTable<any>(
      'attendance',
      isAdmin ? {} : { filters: [{ column: 'uid', value: user.uid }] },
      (data) => {
        setAttendance(data.map(mapAttendanceDbToRecord));
        setLoaded(prev => prev.attendance ? prev : { ...prev, attendance: true });
      }
    );

    const unsubReports = subscribeToTable<any>(
      'daily_reports',
      isAdmin ? {} : { filters: [{ column: 'uid', value: user.uid }] },
      (data) => {
        setReports(data.map(mapReportDbToRecord));
        setLoaded(prev => prev.reports ? prev : { ...prev, reports: true });
      }
    );

    return () => {
      unsubUsers();
      unsubAttendance();
      unsubReports();
    };
  }, [user?.uid, profile?.role]);

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

  // Only show loading if user is present AND none of the streams have delivered yet.
  // Once any data arrives, components can render progressively.
  const loading = !!user && !loaded.attendance && !loaded.reports && !loaded.users;

  const value = {
    attendance,
    reports,
    users,
    loading,
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
