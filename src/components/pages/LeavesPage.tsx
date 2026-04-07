import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { LeaveRequest, UserProfile } from '../../types';
import { ANNUAL_LEAVE_ALLOWANCE, ANNUAL_WFH_ALLOWANCE, DEFAULT_PAGE_SIZE } from '../../lib/constants';
import { computeLeaveBalance } from '../../services/statsService';
import { Button } from '@heroui/react';
import { Plane, Plus, X, Check, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function LeavesPage() {
  const { user, profile } = useAuthContext();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'leave' | 'wfh'>('leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [displayCount, setDisplayCount] = useState(DEFAULT_PAGE_SIZE);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    const q = isAdmin
      ? query(collection(db, 'leaveRequests'), orderBy('startDate', 'desc'))
      : query(collection(db, 'leaveRequests'), where('uid', '==', user.uid), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeaves(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest)));
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

  const myLeaves = leaves.filter((l) => l.uid === user?.uid);
  const leaveBalance = computeLeaveBalance(myLeaves, 'leave', currentYear, ANNUAL_LEAVE_ALLOWANCE);
  const wfhBalance = computeLeaveBalance(myLeaves, 'wfh', currentYear, ANNUAL_WFH_ALLOWANCE);
  const usedLeave = leaveBalance.used;
  const usedWfh = wfhBalance.used;

  const getUserName = (uid: string) => allUsers.find((u) => u.uid === uid)?.name || 'Unknown';

  const displayedLeaves = useMemo(() => leaves.slice(0, displayCount), [leaves, displayCount]);
  const hasMore = displayCount < leaves.length;

  const handleSubmit = async () => {
    if (!user || !profile || !startDate || !endDate || !reason.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        uid: user.uid,
        startDate,
        endDate,
        reason: reason.trim(),
        type: formType,
        status: 'pending',
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to submit leave request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (leave: LeaveRequest) => {
    if (!leave.id) return;
    try {
      await updateDoc(doc(db, 'leaveRequests', leave.id), { status: 'approved' });
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (leave: LeaveRequest) => {
    if (!leave.id) return;
    try {
      await updateDoc(doc(db, 'leaveRequests', leave.id), { status: 'rejected' });
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-36 mb-2 rounded-lg" />
            <div className="skeleton h-4 w-64 rounded-lg" />
          </div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div>
                  <div className="skeleton h-3 w-24 mb-2 rounded-lg" />
                  <div className="skeleton h-6 w-32 rounded-lg" />
                </div>
              </div>
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl glass p-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="skeleton h-4 w-24 mb-2 rounded-lg" />
                <div className="skeleton h-3 w-48 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Leave & WFH</h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Manage leave and work-from-home requests.</p>
        </div>
        <Button
          variant="primary"
          onPress={() => setShowForm(!showForm)}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Request'}
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6 animate-slide-up-fade">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Leave Balance</p>
              <p className="text-2xl font-black text-[hsl(var(--text-primary))]">
                {ANNUAL_LEAVE_ALLOWANCE - usedLeave} <span className="text-sm font-normal text-[hsl(var(--text-muted))]">/ {ANNUAL_LEAVE_ALLOWANCE} days</span>
              </p>
            </div>
          </div>
          <div className="h-2 w-full rounded-full inset-well overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(usedLeave / ANNUAL_LEAVE_ALLOWANCE) * 100}%` }} />
          </div>
        </div>

        <div className="glass rounded-2xl p-6 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <Plane size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">WFH Balance</p>
              <p className="text-2xl font-black text-[hsl(var(--text-primary))]">
                {ANNUAL_WFH_ALLOWANCE - usedWfh} <span className="text-sm font-normal text-[hsl(var(--text-muted))]">/ {ANNUAL_WFH_ALLOWANCE} days</span>
              </p>
            </div>
          </div>
          <div className="h-2 w-full rounded-full inset-well overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(usedWfh / ANNUAL_WFH_ALLOWANCE) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="rounded-2xl glass-elevated p-6 space-y-4 animate-scale-in">
          <div className="flex gap-3">
            {(['leave', 'wfh'] as const).map((t) => (
              <Button
                key={t}
                variant={formType === t ? 'primary' : 'ghost'}
                size="sm"
                onPress={() => setFormType(t)}
                className="uppercase"
              >
                {t === 'wfh' ? 'WFH' : 'Leave'}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--text-muted))] mb-1 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl inset-well px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--text-muted))] mb-1 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl inset-well px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))]"
              />
            </div>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for request..."
            rows={2}
            className="w-full rounded-xl inset-well px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 resize-none text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
          />
          <Button
            variant="primary"
            onPress={handleSubmit}
            isDisabled={submitting || !startDate || !endDate || !reason.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        {leaves.length === 0 ? (
          <div className="text-center py-16">
            <Plane size={40} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
            <p className="text-sm text-[hsl(var(--text-muted))]">No leave requests found.</p>
          </div>
        ) : (
          displayedLeaves.map((leave) => (
            <div key={leave.id} className="rounded-xl glass p-5 flex items-center gap-4 animate-slide-up-fade">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColors[leave.status]}`}>
                    {leave.status}
                  </span>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))]">
                    {leave.type === 'wfh' ? 'WFH' : 'Leave'}
                  </span>
                  {isAdmin && <span className="text-xs text-[hsl(var(--text-muted))]">{getUserName(leave.uid)}</span>}
                </div>
                <p className="text-sm text-[hsl(var(--text-secondary))]">{leave.reason}</p>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                  {leave.startDate} → {leave.endDate}
                </p>
              </div>
              {isAdmin && leave.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => handleApprove(leave)}
                  >
                    <Check size={14} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onPress={() => handleReject(leave)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onPress={() => setDisplayCount((prev) => prev + DEFAULT_PAGE_SIZE)}
          >
            Load More ({leaves.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
