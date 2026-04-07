import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { AttendanceRecord, UserProfile } from '../../types';
import { EXPECTED_START_HOUR, DEFAULT_PAGE_SIZE } from '../../lib/constants';
import { computeAvgShiftDuration, computeOnTimePercentage } from '../../services/statsService';
import { Button } from '@heroui/react';
import { Clock, TrendingUp, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendancePage() {
  const { user, profile } = useAuthContext();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(DEFAULT_PAGE_SIZE);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';

  useEffect(() => {
    if (!user) return;
    const q = isAdmin
      ? query(collection(db, 'attendance'), orderBy('date', 'desc'))
      : query(collection(db, 'attendance'), where('uid', '==', user.uid), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      setLoading(false);
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [isAdmin]);

  const avgShiftDuration = computeAvgShiftDuration(records);
  const onTimePercentage = computeOnTimePercentage(records, EXPECTED_START_HOUR);

  const displayedRecords = useMemo(() => records.slice(0, displayCount), [records, displayCount]);
  const hasMore = displayCount < records.length;

  const getUserName = (uid: string) => allUsers.find((u) => u.uid === uid)?.name || 'Unknown';

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'hh:mm a');
  };

  const statusChipClass: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    wfh: 'bg-blue-100 text-blue-700',
    leave: 'bg-yellow-100 text-yellow-700',
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <div className="skeleton h-7 w-48 mb-2 rounded-lg" />
          <div className="skeleton h-4 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl glass p-5">
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-20 mb-2 rounded-lg" />
                  <div className="skeleton h-5 w-12 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl glass overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[hsl(var(--border-subtle))]">
              <div className="skeleton h-4 w-24 rounded-lg" />
              <div className="skeleton h-4 w-20 rounded-lg" />
              <div className="skeleton h-4 w-20 rounded-lg" />
              <div className="skeleton h-4 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Attendance Log</h2>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
          {isAdmin ? 'Team attendance records and statistics.' : 'Your attendance records and statistics.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl glass p-5 animate-slide-up-fade">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Total Records</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{records.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl glass p-5 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Avg. Shift Duration</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{avgShiftDuration.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl glass p-5 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">On-Time Arrival</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{onTimePercentage.toFixed(0)}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl glass p-5 animate-slide-up-fade" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Present Today</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">
                {records.filter((r) => r.date === format(new Date(), 'yyyy-MM-dd') && r.status === 'present').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table — keep HTML table with glass class */}
      <div className="rounded-2xl glass overflow-hidden animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))]">
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Date</th>
              {isAdmin && <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Employee</th>}
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Check In</th>
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Check Out</th>
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Hours</th>
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedRecords.map((record) => (
              <tr key={record.id} className="border-b border-[hsl(var(--border-subtle))] hover:bg-[hsla(var(--accent),0.05)] transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-[hsl(var(--text-primary))]">{record.date}</td>
                {isAdmin && (
                  <td className="px-6 py-4 text-sm text-[hsl(var(--text-secondary))]">{getUserName(record.uid)}</td>
                )}
                <td className="px-6 py-4 text-sm text-[hsl(var(--text-secondary))]">{formatTime(record.checkInTime)}</td>
                <td className="px-6 py-4 text-sm text-[hsl(var(--text-secondary))]">{formatTime(record.checkOutTime)}</td>
                <td className="px-6 py-4 text-sm font-medium text-[hsl(var(--text-primary))]">
                  {record.totalHours ? `${record.totalHours.toFixed(1)}h` : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusChipClass[record.status]}`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {records.length === 0 && (
          <div className="text-center py-16">
            <Clock size={40} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
            <p className="text-sm text-[hsl(var(--text-muted))]">No attendance records found.</p>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onPress={() => setDisplayCount((prev) => prev + DEFAULT_PAGE_SIZE)}
          >
            Load More ({records.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
