import { useState } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { computeAvgShiftDuration, computeAvgTaskCompletionRate } from '../../services/statsService';
import { AIService, AIAnalysisResult } from '../../services/aiService';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
  Calendar,
  PieChart as PieChartIcon,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user, profile } = useAuthContext();
  const { users: allUsers, attendance: allAttendance, reports: allReports, loading } = useData();

  const [timeFilter, setTimeFilter] = useState<'7' | '30' | '90' | 'all'>('7');
  const [activeTab, setActiveTab] = useState<'overview' | 'team'>('overview');
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // 1. Filter data based on selected time range
  const filterByDateRange = (dateStr: string) => {
    if (timeFilter === 'all') return true;
    const recordDate = new Date(dateStr + 'T00:00:00');
    const limitDate = new Date();
    limitDate.setHours(0, 0, 0, 0);
    limitDate.setDate(limitDate.getDate() - parseInt(timeFilter));
    return recordDate >= limitDate;
  };

  const filteredAttendance = allAttendance.filter((a) => filterByDateRange(a.date));
  const filteredReports = allReports.filter((r) => filterByDateRange(r.date));

  // 2. Compute dynamic metrics
  const avgShiftDuration = computeAvgShiftDuration(filteredAttendance);
  const taskCompletionRate = computeAvgTaskCompletionRate(filteredReports);

  const totalTasks = filteredReports.reduce((acc, r) => acc + (r.todoList?.length || 0), 0);
  const completedTasks = filteredReports.reduce(
    (acc, r) => acc + (r.todoList?.filter((t) => t.completed).length || 0),
    0
  );

  // 3. Collective hours & daily tasks trend (Last N Days)
  const daysToGenerate = timeFilter === 'all' ? 30 : parseInt(timeFilter);
  const dailyTrendsData = Array.from({ length: daysToGenerate }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const label = daysToGenerate <= 7 ? format(d, 'EEE') : format(d, 'MM/dd');

    const dayAttendance = filteredAttendance.filter((a) => a.date === dateStr);
    const dayHours = dayAttendance.reduce((acc, a) => acc + (a.totalHours || 0), 0);

    const dayReports = filteredReports.filter((r) => r.date === dateStr);
    const dayTotalTasks = dayReports.reduce((acc, r) => acc + (r.todoList?.length || 0), 0);
    const dayCompletedTasks = dayReports.reduce(
      (acc, r) => acc + (r.todoList?.filter((t) => t.completed).length || 0),
      0
    );

    return {
      date: dateStr,
      label,
      Hours: Math.round(dayHours * 10) / 10,
      'Total Tasks': dayTotalTasks,
      'Completed Tasks': dayCompletedTasks,
    };
  }).reverse();

  // 4. Attendance distribution counts for Donut Chart
  const presentCount = filteredAttendance.filter((a) => a.status === 'present').length;
  const wfhCount = filteredAttendance.filter((a) => a.status === 'wfh').length;
  const leaveCount = filteredAttendance.filter((a) => a.status === 'leave').length;

  const attendanceDistributionData = [
    { name: 'Present', value: presentCount, color: 'hsl(var(--success))' },
    { name: 'WFH', value: wfhCount, color: 'hsl(var(--info))' },
    { name: 'Leave', value: leaveCount, color: 'hsl(var(--danger))' },
  ].filter((item) => item.value > 0);

  // 5. User stats computed per member within the filtered range
  const userStats = allUsers
    .map((u) => {
      const userAttendance = filteredAttendance.filter((a) => a.uid === u.uid);
      const userReports = filteredReports.filter((r) => r.uid === u.uid);
      const userHours = userAttendance.reduce((acc, a) => acc + (a.totalHours || 0), 0);
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
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  // Filtering users who actually have activity in the selected range to keep team comparison charts clean
  const activeUsersHoursData = userStats
    .filter((u) => u.totalHours > 0)
    .map((u) => ({
      name: u.name,
      Hours: Math.round(u.totalHours * 10) / 10,
    }));

  const activeUsersTasksData = userStats
    .filter((u) => u.totalTasks > 0)
    .map((u) => ({
      name: u.name,
      'Total Tasks': u.totalTasks,
      'Completed Tasks': u.completedTasks,
    }));

  const handleRunAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await AIService.analyzePerformance(allUsers, filteredAttendance, filteredReports);
      setAiResult(result);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'AI analysis failed. The AI proxy endpoint may not be configured yet.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Custom tooltips matching the premium dark glassmorphic design system
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-3 shadow-[inset_0_1px_0_0_var(--glass-highlight),_0_4px_12px_var(--glass-shadow-1)] text-xs text-[hsl(var(--text-primary))]">
          <p className="font-bold text-[hsl(var(--text-secondary))] mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="font-semibold flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.fill }} />
                {entry.name}: {entry.value}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Team Analytics</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl skeuo-panel p-5">
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
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] flex items-center gap-3">
            <BarChart3 size={24} />
            Team Analytics
          </h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
            Overview of team performance, attendance, and productivity metrics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter Capsule */}
          <div className="flex gap-1 p-1 rounded-xl skeuo-well border border-[hsl(var(--border-subtle))]/10 shrink-0">
            {([
              { value: '7', label: '7 Days' },
              { value: '30', label: '30 Days' },
              { value: '90', label: '90 Days' },
              { value: 'all', label: 'All Time' },
            ] as const).map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTimeFilter(filter.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeFilter === filter.value
                    ? 'skeuo-button shadow-sm'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRunAIAnalysis}
            disabled={aiLoading || allUsers.length === 0}
            className="rounded-xl skeuo-button px-5 py-2 text-sm font-bold disabled:opacity-50 flex items-center gap-2 neon-glow-gold"
          >
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {aiLoading ? 'Analyzing...' : 'Run AI Analysis'}
          </button>
        </div>
      </div>

      {/* AI Error */}
      {aiError && (
        <div className="rounded-2xl skeuo-panel p-5 border border-red-200 bg-red-50/50 animate-slide-up-fade">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle size={18} />
            <p className="text-sm font-medium">{aiError}</p>
          </div>
        </div>
      )}

      {/* AI Performance Result */}
      {aiResult && (
        <div className="rounded-2xl skeuo-panel p-6 animate-slide-up-fade space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-[hsl(var(--accent))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
              AI Performance Analysis ({timeFilter === 'all' ? 'All Time' : `Last ${timeFilter} Days`})
            </h3>
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
            <div className="rounded-xl skeuo-well p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] mb-2">
                Insights
              </p>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed whitespace-pre-wrap">
                {aiResult.insights}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl skeuo-panel p-5 animate-slide-up-fade">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-blue border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(210,80%,56%,0.15)] shrink-0">
              <Users size={22} className="skeuo-icon-glow" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Team Size</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{allUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl skeuo-panel p-5 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-green border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(145,70%,50%,0.15)] shrink-0">
              <Clock size={22} className="skeuo-icon-glow" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Avg. Shift Duration</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{avgShiftDuration.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl skeuo-panel p-5 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-amber border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(40,95%,52%,0.15)] shrink-0">
              <TrendingUp size={22} className="skeuo-icon-glow" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Task Completion</p>
              <p className="text-xl font-black text-[hsl(var(--text-primary))]">{taskCompletionRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl skeuo-panel p-5 animate-slide-up-fade" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl skeuo-icon-well flex items-center justify-center skeuo-icon-bg-purple border border-[hsl(var(--border-subtle))]/20 shadow-[0_0_12px_hsla(270,70%,60%,0.15)] shrink-0">
              <CheckCircle2 size={22} className="skeuo-icon-glow" />
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

      {/* Modern Skeuomorphic Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-xl skeuo-well max-w-md border border-[hsl(var(--border-subtle))]/10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 text-center rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'overview'
              ? 'skeuo-button shadow-sm'
              : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'
          }`}
        >
          Overview & Trends
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-2 text-center rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'team'
              ? 'skeuo-button shadow-sm'
              : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'
          }`}
        >
          Team Comparison
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Work Hours Timeline */}
          <div className="skeuo-panel p-6 animate-slide-up-fade">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp size={18} className="text-[hsl(var(--accent))]" />
              <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                Collective Work Hours ({timeFilter === 'all' ? 'Last 30 Days' : `Last ${timeFilter} Days`})
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border-subtle), 0.35)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--text-muted))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--text-muted))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Hours"
                    stroke="hsl(var(--accent))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#chartGlow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sub Grid of Donut + Productivity Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Status Donut Chart */}
            <div className="skeuo-panel p-6 animate-slide-up-fade h-80 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <PieChartIcon size={18} className="text-[hsl(var(--accent))]" />
                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                  Attendance Distribution
                </h3>
              </div>
              {attendanceDistributionData.length > 0 ? (
                <div className="flex-1 flex items-center justify-between gap-4 mt-2">
                  <div className="h-44 w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={attendanceDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {attendanceDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {attendanceDistributionData.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-xs border-b border-[hsl(var(--border-subtle))]/20 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="font-semibold text-[hsl(var(--text-secondary))]">{entry.name}</span>
                        </div>
                        <span className="font-bold text-[hsl(var(--text-primary))]">{entry.value} shifts</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                  <PieChartIcon size={32} className="text-[hsl(var(--text-muted))]/30 mb-3" />
                  <p className="text-xs text-[hsl(var(--text-muted))]">No attendance logs in this range</p>
                </div>
              )}
            </div>

            {/* Daily Tasks Productivity Trend Chart */}
            <div className="skeuo-panel p-6 animate-slide-up-fade h-80 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-[hsl(var(--accent))]" />
                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                  Daily Task Completion Trend
                </h3>
              </div>
              <div className="flex-1 h-44 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrendsData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border-subtle), 0.35)" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--text-muted))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--text-muted))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      height={32} 
                      iconSize={8}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <Bar dataKey="Total Tasks" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} barSize={10} />
                    <Bar dataKey="Completed Tasks" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Member Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hours comparison horizontal bar chart */}
            <div className="skeuo-panel p-6 animate-slide-up-fade min-h-[320px] flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={18} className="text-[hsl(var(--accent))]" />
                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                  Hours Logged by Member
                </h3>
              </div>
              {activeUsersHoursData.length > 0 ? (
                <div className="flex-grow h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeUsersHoursData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border-subtle), 0.35)" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(var(--text-muted))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Hours" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                  <Clock size={32} className="text-[hsl(var(--text-muted))]/30 mb-3" />
                  <p className="text-xs text-[hsl(var(--text-muted))]">No work hours logged in this range</p>
                </div>
              )}
            </div>

            {/* Task completion comparison bar chart */}
            <div className="skeuo-panel p-6 animate-slide-up-fade min-h-[320px] flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 size={18} className="text-[hsl(var(--accent))]" />
                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                  Tasks Handled by Member
                </h3>
              </div>
              {activeUsersTasksData.length > 0 ? (
                <div className="flex-grow h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeUsersTasksData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border-subtle), 0.35)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        verticalAlign="top" 
                        height={32} 
                        iconSize={8}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="Total Tasks" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} barSize={12} />
                      <Bar dataKey="Completed Tasks" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                  <CheckCircle2 size={32} className="text-[hsl(var(--text-muted))]/30 mb-3" />
                  <p className="text-xs text-[hsl(var(--text-muted))]">No tasks reported in this range</p>
                </div>
              )}
            </div>
          </div>

          {/* Team Leaderboard */}
          <div className="rounded-2xl skeuo-panel overflow-hidden animate-slide-up-fade">
            <div className="px-6 py-4 border-b border-[hsl(var(--border-subtle))] flex items-center gap-3">
              <Award size={18} className="text-[hsl(var(--accent))]" />
              <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] uppercase tracking-widest">
                Team Leaderboard ({timeFilter === 'all' ? 'All Time' : `Last ${timeFilter} Days`})
              </h3>
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
                        <div className="h-3 w-16 rounded-full skeuo-well overflow-hidden p-[1px]">
                          <div
                            className="h-full skeuo-progress-bar-success rounded-full"
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
      )}
    </div>
  );
}

