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
import { DailyReport, UserProfile } from '../../types';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants';
import { Button, Card, CardContent, Skeleton } from '@heroui/react';
import { FileText, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportsPage() {
  const { user, profile } = useAuthContext();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(DEFAULT_PAGE_SIZE);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';

  useEffect(() => {
    if (!user) return;
    const q = isAdmin
      ? query(collection(db, 'dailyReports'), orderBy('date', 'desc'))
      : query(collection(db, 'dailyReports'), where('uid', '==', user.uid), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyReport)));
      setLoading(false);
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map((d) => d.data() as UserProfile));
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
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
          <Skeleton className="h-7 w-40 mb-2 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="glass rounded-2xl">
              <CardContent className="p-6">
                <Skeleton className="h-3 w-20 mb-4 rounded-lg" />
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-3 w-full rounded-lg" />
                  <Skeleton className="h-3 w-3/4 rounded-lg" />
                  <Skeleton className="h-3 w-1/2 rounded-lg" />
                </div>
                <Skeleton className="h-1.5 w-16 rounded-lg" />
              </CardContent>
            </Card>
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
              <Card key={report.id} className="glass rounded-2xl animate-slide-up-fade">
                <CardContent className="p-6">
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

                  <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border-subtle))]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full inset-well overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[hsl(var(--text-muted))]">
                        {completedTasks}/{totalTasks}
                      </span>
                    </div>
                    {report.reportUrl && (
                      <a
                        href={report.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[hsl(var(--accent))] hover:opacity-80"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onPress={() => setDisplayCount((prev) => prev + DEFAULT_PAGE_SIZE)}
          >
            Load More ({reports.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
