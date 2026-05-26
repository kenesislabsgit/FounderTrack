import { useState, useEffect, useRef } from 'react';
import { supabase, subscribeToTable } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { AttendanceRecord, DailyReport, TodoItem } from '../../types';
import { SHIFT_DURATION_HOURS } from '../../lib/constants';
import { computeShiftProgress } from '../../services/statsService';
import { uploadCheckInPhoto } from '../../services/storageService';
import { mapAttendanceDbToRecord, mapReportDbToRecord } from '../../services/dataService';
import RichTextEditor from '../ui/RichTextEditor';

import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  Circle,
  Plus,
  FileText,
  Loader2,
  Camera,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

const MAX_IMAGE_DIMENSION = 800;
const IMAGE_QUALITY = 0.8;

/**
 * Compresses and resizes an image file, returning a Blob.
 * Uses canvas.toBlob instead of toDataURL to avoid base64 overhead.
 */
function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        },
        'image/jpeg',
        IMAGE_QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function DashboardPage() {
  const { user, profile } = useAuthContext();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportTab, setReportTab] = useState<'write' | 'link'>('write');
  const [shiftProgress, setShiftProgress] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  // 1. Subscribe to today's attendance record
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTable<any>(
      'attendance',
      {
        filters: [
          { column: 'uid', value: user.uid },
          { column: 'date', value: today },
        ],
      },
      (data) => {
        if (data.length > 0) {
          setTodayRecord(mapAttendanceDbToRecord(data[0]));
        } else {
          setTodayRecord(null);
        }
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, today]);

  // 2. Subscribe to today's daily report
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTable<any>(
      'daily_reports',
      {
        filters: [
          { column: 'uid', value: user.uid },
          { column: 'date', value: today },
        ],
      },
      (data) => {
        if (data.length > 0) {
          const record = mapReportDbToRecord(data[0]);
          setTodayReport(record);
          if (record.reportUrl) {
            if (/^(https?:\/\/)/i.test(record.reportUrl)) {
              setReportUrl(record.reportUrl);
              setReportTab('link');
            } else {
              setReportText(record.reportUrl);
              setReportTab('write');
            }
          }
        } else {
          setTodayReport(null);
        }
      }
    );
    return unsubscribe;
  }, [user, today]);

  // 3. Subscribe to recent shifts (last 7 days)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTable<any>(
      'attendance',
      {
        filters: [{ column: 'uid', value: user.uid }],
        orderBy: { column: 'date', ascending: false },
        limit: 7,
      },
      (data) => {
        setRecentRecords(data.map(mapAttendanceDbToRecord));
      }
    );
    return unsubscribe;
  }, [user]);

  // 4. Update shift progress bar
  useEffect(() => {
    if (!todayRecord?.checkInTime || todayRecord?.checkOutTime) {
      setShiftProgress(todayRecord?.checkOutTime ? 100 : 0);
      return;
    }
    const updateProgress = () => {
      const checkIn = new Date(todayRecord.checkInTime);
      setShiftProgress(computeShiftProgress(checkIn, SHIFT_DURATION_HOURS));
    };
    updateProgress();
    const interval = setInterval(updateProgress, 60000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setCheckingIn(true);
    try {
      let checkInPhoto: string | undefined;
      if (selectedPhoto) {
        const blob = await processImage(selectedPhoto);
        const filename = `checkin-${Date.now()}.jpg`;
        checkInPhoto = await uploadCheckInPhoto(user.uid, today, blob, filename);
      }

      await supabase.from('attendance').insert({
        uid: user.uid,
        date: today,
        check_in_time: new Date().toISOString(),
        status: 'present',
        ...(checkInPhoto && { check_in_photo: checkInPhoto }),
      });

      clearPhoto();
    } catch (err) {
      console.error('Check-in failed:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.id) return;
    setCheckingOut(true);
    try {
      const checkIn = new Date(todayRecord.checkInTime);
      const totalHours = (Date.now() - checkIn.getTime()) / (1000 * 60 * 60);

      await supabase
        .from('attendance')
        .update({
          check_out_time: new Date().toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
        })
        .eq('id', todayRecord.id);
    } catch (err) {
      console.error('Check-out failed:', err);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAddTask = async () => {
    if (!user || !newTask.trim()) return;
    const task: TodoItem = { task: newTask.trim(), completed: false };
    try {
      if (todayReport?.id) {
        await supabase
          .from('daily_reports')
          .update({
            todo_list: [...(todayReport.todoList || []), task],
          })
          .eq('id', todayReport.id);
      } else {
        await supabase.from('daily_reports').insert({
          uid: user.uid,
          date: today,
          todo_list: [task],
        });
      }
      setNewTask('');
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleToggleTask = async (index: number) => {
    if (!todayReport?.id || !todayReport.todoList) return;
    const updated = [...todayReport.todoList];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    try {
      await supabase
        .from('daily_reports')
        .update({ todo_list: updated })
        .eq('id', todayReport.id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleSaveReportUrl = async () => {
    if (!user || !reportUrl.trim()) return;
    try {
      if (todayReport?.id) {
        await supabase
          .from('daily_reports')
          .update({ report_url: reportUrl.trim() })
          .eq('id', todayReport.id);
      } else {
        await supabase.from('daily_reports').insert({
          uid: user.uid,
          date: today,
          report_url: reportUrl.trim(),
          todo_list: [],
        });
      }
    } catch (err) {
      console.error('Failed to save report URL:', err);
    }
  };

  const handleSaveReportText = async () => {
    if (!user || !reportText.trim()) return;
    try {
      if (todayReport?.id) {
        await supabase
          .from('daily_reports')
          .update({ report_url: reportText.trim() })
          .eq('id', todayReport.id);
      } else {
        await supabase.from('daily_reports').insert({
          uid: user.uid,
          date: today,
          report_url: reportText.trim(),
          todo_list: [],
        });
      }
    } catch (err) {
      console.error('Failed to save report text:', err);
    }
  };

  const todoList = todayReport?.todoList || [];
  const completedCount = todoList.filter((t) => t.completed).length;
  const taskProgress = todoList.length > 0 ? (completedCount / todoList.length) * 100 : 0;

  const isCheckedIn = !!todayRecord?.checkInTime && !todayRecord?.checkOutTime;
  const isCheckedOut = !!todayRecord?.checkOutTime;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <div className="skeleton h-7 w-56 mb-2 rounded-lg" />
          <div className="skeleton h-4 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="skeuo-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div>
                    <div className="skeleton h-4 w-28 mb-1 rounded-lg" />
                    <div className="skeleton h-3 w-20 rounded-lg" />
                  </div>
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
              <div className="skeleton h-3 w-full rounded-full mb-4" />
              <div className="skeleton h-12 w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="skeuo-panel rounded-2xl p-6">
              <div className="skeleton h-4 w-24 mb-4 rounded-lg" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <div className="skeleton h-3 w-20 rounded-lg" />
                    <div className="skeleton h-3 w-10 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
          Welcome back, {profile?.name?.split(' ')[0] || 'there'} 👋
        </h2>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift Tracking Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-amber border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(40,95%,52%,0.15)] shrink-0">
                  <Clock size={22} className="skeuo-icon-glow" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[hsl(var(--text-primary))] uppercase tracking-widest font-heading">Today's Shift</h3>
                  <p className="text-xs text-[hsl(var(--text-muted))]">{today}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                  isCheckedIn
                    ? 'bg-green-100 text-green-700'
                    : isCheckedOut
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))]'
                }`}
              >
                {isCheckedIn ? 'Active' : isCheckedOut ? 'Completed' : 'Not Started'}
              </span>
            </div>

            {/* Shift Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[hsl(var(--text-muted))]">Shift Progress</span>
                <span className="font-bold text-[hsl(var(--text-primary))]">{shiftProgress.toFixed(0)}%</span>
              </div>
              <div className="h-4 w-full rounded-full skeuo-well overflow-hidden p-[2px]">
                <div
                  className="h-full rounded-full skeuo-progress-bar"
                  style={{ width: `${shiftProgress}%` }}
                />
              </div>
              {todayRecord?.checkInTime && (
                <p className="text-[10px] text-[hsl(var(--text-muted))] mt-2">
                  Checked in at{' '}
                  {format(new Date(todayRecord.checkInTime), 'hh:mm a')}
                  {todayRecord.checkOutTime && (
                    <>
                      {' · Checked out at '}
                      {format(new Date(todayRecord.checkOutTime), 'hh:mm a')}
                    </>
                  )}
                  {todayRecord.totalHours && ` · ${todayRecord.totalHours.toFixed(1)}h total`}
                </p>
              )}
            </div>

            {/* Check-In Photo */}
            {!todayRecord && (
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="check-in-photo"
                />
                {photoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Check-in preview"
                      className="h-24 w-24 rounded-xl object-cover border border-[hsl(var(--border-subtle))]"
                    />
                    <button
                      onClick={clearPhoto}
                      className="absolute -top-2 -right-2 h-5 w-5 min-w-0 rounded-full p-0 flex items-center justify-center bg-gradient-to-b from-[hsl(0,72%,58%)] to-[hsl(0,72%,48%)] text-white text-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border-default))] px-4 py-2.5 text-xs text-[hsl(var(--text-muted))] hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] transition-colors"
                  >
                    <Camera size={14} />
                    Add check-in photo
                  </button>
                )}
              </div>
            )}

            {/* Display check-in photo */}
            {todayRecord?.checkInPhoto && (
              <div className="mb-4">
                <p className="text-[10px] text-[hsl(var(--text-muted))] mb-1">Check-in Photo</p>
                <img
                  src={todayRecord.checkInPhoto}
                  alt="Check-in photo"
                  className="h-24 w-24 rounded-xl object-cover border border-[hsl(var(--border-subtle))]"
                />
              </div>
            )}

            {/* Check In/Out Buttons */}
            <div className="flex gap-3">
              {!todayRecord ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="flex-1 rounded-xl skeuo-button-success px-5 py-3 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 neon-glow-success"
                >
                  {checkingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {checkingIn ? 'Checking In...' : 'Check In'}
                </button>
              ) : isCheckedIn ? (
                <button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  className="flex-1 rounded-xl skeuo-button-danger px-5 py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 neon-glow-danger"
                >
                  {checkingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  {checkingOut ? 'Checking Out...' : 'Check Out'}
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--bg-elevated))] py-3 text-sm font-bold text-[hsl(var(--text-muted))]">
                  <CheckCircle2 size={16} />
                  Shift Completed
                </div>
              )}
            </div>
          </div>

          {/* Todo List */}
          <div className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-green border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(145,70%,50%,0.15)] shrink-0">
                  <CheckCircle2 size={18} className="skeuo-icon-glow" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[hsl(var(--text-primary))] uppercase tracking-widest font-heading">Today's Tasks</h3>
                  <span className="text-xs font-semibold text-[hsl(var(--text-muted))]">
                    {completedCount}/{todoList.length} Tasks
                  </span>
                </div>
              </div>
              {todoList.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-20 rounded-full skeuo-well overflow-hidden p-[1px]">
                    <div className="h-full skeuo-progress-bar-success rounded-full" style={{ width: `${taskProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[hsl(var(--text-muted))]">{taskProgress.toFixed(0)}%</span>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {todoList.map((todo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleToggleTask(idx)}
                  className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-[hsla(var(--accent),0.05)] transition-colors"
                >
                  {todo.completed ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <Circle size={18} className="text-[hsl(var(--text-muted))] shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      todo.completed ? 'text-[hsl(var(--text-muted))] line-through' : 'text-[hsl(var(--text-secondary))]'
                    }`}
                  >
                    {todo.task}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Add a task..."
                className="flex-1 rounded-xl skeuo-well px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))]/30"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTask.trim()}
                className="rounded-xl skeuo-button px-3 py-1.5 text-xs font-bold disabled:opacity-50 flex items-center gap-2 neon-glow-gold"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Daily Report Word Editor and URL Panel */}
          <div className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="h-11 w-11 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-blue border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(210,80%,56%,0.15)] shrink-0">
                <FileText size={18} className="skeuo-icon-glow" />
              </div>
              <h3 className="text-sm font-extrabold text-[hsl(var(--text-primary))] uppercase tracking-widest font-heading">Daily Report</h3>
            </div>

            {/* Premium Skeuomorphic Tab Selector */}
            <div className="flex rounded-xl skeuo-well p-1 mb-4 w-full border border-[hsl(var(--border-subtle))]/10">
              <button
                onClick={() => setReportTab('write')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  reportTab === 'write'
                    ? 'skeuo-button shadow-sm'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                Write Entry
              </button>
              <button
                onClick={() => setReportTab('link')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  reportTab === 'link'
                    ? 'skeuo-button shadow-sm'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                Attach Link
              </button>
            </div>

            {reportTab === 'write' ? (
              /* DIRECT WORD EDITOR */
              <div className="space-y-4">
                <RichTextEditor
                  value={reportText}
                  onChange={setReportText}
                  uid={user?.uid || ''}
                  date={today}
                  placeholder="Draft your daily report document here... Use standard styling controls or click Templates to inject standard structures instantly."
                />
                <button
                  onClick={handleSaveReportText}
                  disabled={!reportText.trim() || reportText === '<p></p>' || reportText === '<br>'}
                  className="w-full rounded-xl skeuo-button py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 neon-glow-gold"
                >
                  Save Report Entry
                </button>
              </div>
            ) : (
              /* EXTERNAL LINK ENTRANCE */
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={reportUrl}
                    onChange={(e) => setReportUrl(e.target.value)}
                    placeholder="Paste your daily report URL..."
                    className="flex-1 rounded-xl skeuo-well px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))]/30"
                  />
                  <button
                    onClick={handleSaveReportUrl}
                    disabled={!reportUrl.trim()}
                    className="rounded-xl skeuo-button px-5 py-2.5 text-sm font-bold disabled:opacity-50 flex items-center gap-2 neon-glow-gold shrink-0"
                  >
                    Save Link
                  </button>
                </div>
                {todayReport?.reportUrl && /^(https?:\/\/)/i.test(todayReport.reportUrl) && (
                  <a
                    href={todayReport.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-[hsl(var(--accent))] hover:underline"
                  >
                    View submitted link →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] mb-4">Last 7 Days</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-xs text-[hsl(var(--text-muted))]">Days Worked</span>
                <span className="text-sm font-bold text-[hsl(var(--text-primary))]">{recentRecords.filter((r) => r.checkOutTime).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[hsl(var(--text-muted))]">Total Hours</span>
                <span className="text-sm font-bold text-[hsl(var(--text-primary))]">
                  {recentRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0).toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[hsl(var(--text-muted))]">Tasks Done</span>
                <span className="text-sm font-bold text-[hsl(var(--text-primary))]">{completedCount}</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="skeuo-panel rounded-2xl p-6 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
            <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest mb-4">Recent Shifts</h3>
            <div className="space-y-3">
              {recentRecords.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border-subtle))] last:border-0">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--text-primary))]">{record.date}</p>
                    <p className="text-[10px] text-[hsl(var(--text-muted))] capitalize">{record.status}</p>
                  </div>
                  <span className="text-xs font-bold text-[hsl(var(--text-secondary))]">
                    {record.totalHours ? `${record.totalHours.toFixed(1)}h` : '—'}
                  </span>
                </div>
              ))}
              {recentRecords.length === 0 && (
                <p className="text-xs text-[hsl(var(--text-muted))] italic">No recent shifts</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
