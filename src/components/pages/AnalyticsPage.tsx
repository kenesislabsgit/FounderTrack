import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { AttendanceRecord, UserProfile, DailyReport } from '../../types';
import { computeAvgShiftDuration, computeAvgTaskCompletionRate } from '../../services/statsService';
import { AIService, AIAnalysisResult } from '../../services/aiService';

import {
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  CheckCircle2,
  Award,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user, profile } = useAuthContext();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded >= 3) setLoading(false);
    };
    const onErr = (err: Error) => console.warn('Firestore listener error:', err.message);
    const unsubs = [
      onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
        checkLoaded();
      }, onErr),
      onSnapshot(collection(db, 'attendance'), (snap) => {
        setAllAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
        checkLoaded();
      }, onErr),
      onSnapshot(collection(db, 'dailyReports'), (snap) => {
        setAllReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyReport)));
        checkLoaded();
      }, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const avgShiftDuration = computeAvgShiftDuration(allAttendance);
  const taskCompletionRate = computeAvgTaskCompletionRate(allReports);

  const totalTasks = allReports.reduce((acc, r) => acc + (r.todoList?.length || 0), 0);
  const completedTasks = allReports.reduce(
    (acc, r) => acc + (r.todoList?.filter((t) => t.completed).length || 0),
    0
  );

  const userStats = allUsers.map((u) => {
    const userAttendance = allAttendance.filter((a) => a.uid === u.uid);
    const userReports = allReports.filter((r) => r.uid === u.uid);
    const userHours = userAttendance.reduce((acc, r) => acc + (r.totalHours || 0), 0);
    const userTotalTasks = userReports.reduce((acc, r) => acc + (r.todoList?.length || 0), 0);
    const userCompletedTasks = userReports.reduce(
      (acc, r) => acc + (r.todoList?.filter((t) => t.completed).length || 0),
      0
    );
    return {
      ...u,
      totalHours: userHours,
      totalTasks: userTotalTasks,
      completedTasks: userCompletedTasks,
      completionRate: userTotalTasks > 0 ? (userCompletedTasks / userTotalTasks) * 100 : 0,
      attendanceCount: userAttendance.length,
    };
  }).sort((a, b) => b.totalHours - a.totalHours);

  const handleRunAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await AIService.analyzePerformance(allUsers, allAttendance, allReports);
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed. The AI proxy endpoint may not be configured yet.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Team Analytics</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl glass p-5">
              <div className="skeleton h-4 w-1/2 mb-3 rounded-lg" />
              <div className="skeleton h-8 w-1/3 rounded-lg" />
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
          <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] flex items-center gap-3">
            <BarChart3 size={24} />
            Team Analytics
          </h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Overview of team performance and productivity metrics.</p>
        </div>
        <button
          onClick={handleRunAIAnalysis}
          disabled={aiLoading || allUsers.length === 0}
          className="rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-2"
        >
          {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {aiLoading ? 'Analyzing...' : 'Run AI Analysis'}
        </button>
      </div>

      {/* AI Analysis Error */}
      {aiError && (
        <div className="rounded-2xl glass p-5 border border-red-200 bg-red-50/50 animate-slide-up-fade">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle size={18} />
            <p className="text-sm font-medium">{aiError}</p>
          </div>
        </div>
      )}

      {/* AI Analysis Results */}
      {aiResult && (
        <div className="rounded-2xl glass p-6 animate-slide-up-fade space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-[hsl(var(--accent))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">AI Analysis</h3>
          </div>
          {aiResult.topPerformer && (
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              <span className="font-bold text-[hsl(var(--text-primary))]">Top Performer:</span> {aiResult.topPerformer}
            </p>
          )}
          {aiResult.summary && (
            <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{aiResult.summary}</p>
          )}
          {aiResult.insights && (
            <div className="rounded-xl inset-well p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] mb-2">Insights</p>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed whitespace-pre-wrap">{aiResult.insights}</p>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl glass p-5 animate-slide-up-fade">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Team Size</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{allUsers.length}</p>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Task Completion</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{taskCompletionRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl glass p-5 animate-slide-up-fade" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Tasks Completed</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">
                {completedTasks} <span className="text-sm font-normal text-[hsl(var(--text-muted))]">/ {totalTasks}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Leaderboard — keep HTML table with glass class */}
      <div className="rounded-2xl glass overflow-hidden animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
        <div className="px-6 py-4 border-b border-[hsl(var(--border-subtle))] flex items-center gap-3">
          <Award size={18} className="text-[hsl(var(--accent))]" />
          <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">Team Leaderboard</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))]">
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">#</th>
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Member</th>
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Role</th>
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Hours</th>
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Tasks</th>
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Completion</th>
            </tr>
          </thead>
          <tbody>
            {userStats.map((u, idx) => (
              <tr key={u.uid} className="border-b border-[hsl(var(--border-subtle))] hover:bg-[hsla(var(--accent),0.05)] transition-colors">
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      idx === 0
                        ? 'bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] text-white'
                        : idx === 1
                          ? 'bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-secondary))]'
                          : idx === 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center text-xs font-bold overflow-hidden border border-[hsl(var(--border-default))]">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        u.name?.[0] || '?'
                      )}
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--text-primary))]">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className="text-xs text-[hsl(var(--text-muted))] capitalize">{u.role}</span>
                </td>
                <td className="px-6 py-3 text-sm font-medium text-[hsl(var(--text-primary))]">{u.totalHours.toFixed(1)}h</td>
                <td className="px-6 py-3 text-sm text-[hsl(var(--text-secondary))]">
                  {u.completedTasks}/{u.totalTasks}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full inset-well overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${u.completionRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[hsl(var(--text-muted))]">{u.completionRate.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {userStats.length === 0 && (
          <div className="text-center py-16">
            <BarChart3 size={40} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
            <p className="text-sm text-[hsl(var(--text-muted))]">No data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
