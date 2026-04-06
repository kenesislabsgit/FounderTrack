import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { AttendanceRecord, UserProfile, DailyReport } from '../types';

/**
 * DataService abstracts the data fetching logic.
 * If the database changes to Supabase or AWS, only this file needs to be updated.
 */
export const DataService = {
  // Real-time listeners
  subscribeToAttendance: (uid: string, callback: (data: AttendanceRecord[]) => void) => {
    const q = query(collection(db, 'attendance'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    });
  },

  subscribeToAllAttendance: (callback: (data: AttendanceRecord[]) => void) => {
    const q = query(collection(db, 'attendance'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    });
  },

  subscribeToAllReports: (callback: (data: DailyReport[]) => void) => {
    const q = query(collection(db, 'dailyReports'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport)));
    });
  },

  subscribeToAllUsers: (callback: (data: UserProfile[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(d => d.data() as UserProfile));
    });
  },

  // One-time fetches for AI analysis
  getAllDataForAnalysis: async () => {
    const [usersSnap, attendanceSnap, reportsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'dailyReports'))
    ]);

    const users = usersSnap.docs.map(d => d.data() as UserProfile);
    const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport));

    return { users, attendance, reports };
  }
};
