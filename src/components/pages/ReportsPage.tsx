import { useState, useEffect, useMemo } from 'react';
import { supabase, subscribeToTable } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { DailyReport, UserProfile } from '../../types';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants';
import { mapReportDbToRecord, mapUserDbToProfile } from '../../services/dataService';

import { FileText, CheckCircle2, Circle, ExternalLink } from 'lucide-react';

export default function ReportsPage() {
  const { user, profile } = useAuthContext();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(DEFAULT_PAGE_SIZE);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTable<any>(
      'daily_reports',
      {
        filters: isAdmin ? [] : [{ column: 'uid', value: user.uid }],
        orderBy: { column: 'date', ascending: false },
      },
      (data) => {
        setReports(data.map(mapReportDbToRecord));
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeToTable<any>(
      'users',
      {},
      (data) => {
        setAllUsers(data.map(mapUserDbToProfile));
      }
    );
    return unsubscribe;
  }, [isAdmin]);

  const getUserName = (uid: string) => {
    const u = allUsers.find((u) => u.uid === uid);
    return u?.name || 'Unknown';
  };

  const displayedReports = useMemo(() => reports.slice(0, displayCount), [reports, displayCount]);
  const hasMore = displayCount < reports.length;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <div className="skeleton h-7 w-40 mb-2 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass rounded-2xl p-6">
              <div className="skeleton h-3 w-20 mb-4 rounded-lg" />
              <div className="space-y-2 mb-4">
                <div className="skeleton h-3 w-full rounded-lg" />
                <div className="skeleton h-3 w-3/4 rounded-lg" />
                <div className="skeleton h-3 w-1/2 rounded-lg" />
              </div>
              <div className="skeleton h-1.5 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Daily Reports</h2>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
          {isAdmin ? 'All team daily reports and task progress.' : 'Your daily reports and task progress.'}
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
          <p className="text-sm text-[hsl(var(--text-muted))]">No reports found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedReports.map((report) => {
            const totalTasks = report.todoList?.length || 0;
            const completedTasks = report.todoList?.filter((t) => t.completed).length || 0;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={report.id} className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[hsl(var(--text-muted))] uppercase tracking-widest">
                    {report.date}
                  </span>
                  {isAdmin && (
                    <span className="text-xs text-[hsl(var(--text-muted))]">{getUserName(report.uid)}</span>
                  )}
                </div>

                {report.todoList && report.todoList.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {report.todoList.map((todo, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {todo.completed ? (
                          <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <Circle size={14} className="text-[hsl(var(--text-muted))] mt-0.5 shrink-0" />
                        )}
                        <span
                          className={`text-xs leading-relaxed ${
                            todo.completed ? 'text-[hsl(var(--text-muted))] line-through' : 'text-[hsl(var(--text-secondary))]'
                          }`}
                        >
                          {todo.task}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[hsl(var(--text-muted))] italic mb-4">No tasks recorded</p>
                )}

                {/* If direct text report, render it inline inside a premium sunken well */}
                {report.reportUrl && !/^(https?:\/\/)/i.test(report.reportUrl) && (
                  <div className="rounded-xl skeuo-well p-3.5 mb-4 text-xs text-[hsl(var(--text-secondary))] leading-relaxed border border-[hsl(var(--border-subtle))]/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] font-sans">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1.5 border-b border-[hsl(var(--border-subtle))]/20 pb-1">Report Entry Log</p>
                    {/<\/?[a-z][\s\S]*>/i.test(report.reportUrl) ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed rich-report-content"
                        dangerouslySetInnerHTML={{ __html: report.reportUrl }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{report.reportUrl}</div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border-subtle))]/40">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-16 rounded-full skeuo-well overflow-hidden p-[1px]">
                      <div
                        className="h-full skeuo-progress-bar-success rounded-full"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[hsl(var(--text-muted))]">
                      {completedTasks}/{totalTasks} Tasks
                    </span>
                  </div>
                  {report.reportUrl && /^(https?:\/\/)/i.test(report.reportUrl) && (
                    <a
                      href={report.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[hsl(var(--accent))] hover:opacity-80 active:scale-95"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => setDisplayCount((prev) => prev + DEFAULT_PAGE_SIZE)}
            className="rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.05)] transition-colors flex items-center gap-2"
          >
            Load More ({reports.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
