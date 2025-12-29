import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { apiFetch } from '@/config/api';
import { formatTime } from '@/lib/utils';
import { Clock, Target, TrendingUp, Calendar, BarChart3, Activity, Sparkles, Zap } from 'lucide-react';

interface AnalyticsData {
  date: string;
  studyHours: number;
  tasksCompleted: number;
  understanding: number;
  sessions: number;
  sessionTypes: Record<string, number>;
}

interface AnalyticsDashboardProps {
  className?: string;
}

export default function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/timer/analytics?days=${timeRange}`);
        if (res.ok) setAnalytics(await res.json());
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [timeRange]);

  const totalStudyHours = analytics.reduce((sum, day) => sum + day.studyHours, 0);
  const totalTasks = analytics.reduce((sum, day) => sum + day.tasksCompleted, 0);
  const totalSessions = analytics.reduce((sum, day) => sum + day.sessions, 0);
  const avgUnderstanding = analytics.length > 0 ? analytics.reduce((sum, day) => sum + day.understanding, 0) / analytics.length : 0;
  const maxHours = Math.max(...analytics.map(d => d.studyHours), 1);
  const maxTasks = Math.max(...analytics.map(d => d.tasksCompleted), 1);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yest';
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  if (loading) {
    return (
      <Card className={`rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative h-12 w-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const StatCard = ({ icon: Icon, label, value, gradient, subtext }: { icon: any; label: string; value: string; gradient: string; subtext?: string }) => (
    <div className="group relative overflow-hidden rounded-2xl p-5 bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-500/10">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
      <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${gradient} rounded-full opacity-10 blur-2xl`} />
      <div className="relative flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subtext && <p className="text-xs text-violet-500 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Study Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Track your learning progress</p>
        </div>
        <div className="flex gap-2 p-1 bg-muted/50 rounded-2xl">
          {[7, 14, 30].map((days) => (
            <Button key={days} variant={timeRange === days ? 'default' : 'ghost'} size="sm"
              onClick={() => setTimeRange(days)}
              className={`rounded-xl transition-all ${timeRange === days ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg' : ''}`}>
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Total Study Time" value={formatTime(Math.round(totalStudyHours * 3600))} gradient="from-blue-500 to-cyan-500" />
        <StatCard icon={Target} label="Tasks Completed" value={totalTasks.toString()} gradient="from-emerald-500 to-teal-500" />
        <StatCard icon={Activity} label="Focus Sessions" value={totalSessions.toString()} gradient="from-orange-500 to-amber-500" />
        <StatCard icon={TrendingUp} label="Avg Understanding" value={`${avgUnderstanding.toFixed(1)}/10`} gradient="from-violet-500 to-purple-600" />
      </div>

      {/* Study Hours Chart */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Daily Study Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 flex items-end justify-between gap-2 sm:gap-4">
            {analytics.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-2 flex-1 group">
                {/* Value */}
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {day.studyHours.toFixed(1)}h
                </span>
                {/* Bar */}
                <div className="relative w-full max-w-12 h-44 bg-gradient-to-t from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl overflow-hidden">
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400 rounded-xl transition-all duration-1000 ease-out group-hover:shadow-lg group-hover:shadow-blue-500/30"
                    style={{ height: `${(day.studyHours / maxHours) * 100}%`, animationDelay: `${index * 100}ms` }}
                  />
                  <div className="absolute bottom-0 w-full bg-gradient-to-t from-blue-400/40 to-transparent blur-sm transition-all duration-1000"
                    style={{ height: `${(day.studyHours / maxHours) * 100}%` }} />
                </div>
                {/* Label */}
                <span className="text-xs font-medium text-muted-foreground">{getDateLabel(day.date)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Combined Progress */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 to-blue-500/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Daily Progress
          </CardTitle>
          <div className="flex items-center gap-4 text-xs mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 to-cyan-400" />
              <span className="text-muted-foreground">Study Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-t from-emerald-600 to-teal-400" />
              <span className="text-muted-foreground">Tasks</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-56 flex items-end justify-between gap-2 sm:gap-3">
            {analytics.map((day, index) => (
              <div key={`combined-${day.date}`} className="flex flex-col items-center gap-2 flex-1 group">
                <div className="flex gap-1 items-end h-40">
                  {/* Hours Bar */}
                  <div className="relative w-4 sm:w-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg overflow-hidden">
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-lg transition-all duration-1000"
                      style={{ height: `${(day.studyHours / maxHours) * 100}%`, animationDelay: `${index * 100}ms` }} />
                  </div>
                  {/* Tasks Bar */}
                  <div className="relative w-4 sm:w-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg overflow-hidden">
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-lg transition-all duration-1000"
                      style={{ height: `${(day.tasksCompleted / maxTasks) * 100}%`, animationDelay: `${index * 100 + 50}ms` }} />
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{getDateLabel(day.date)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Types */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-violet-500" />
            Focus Session Types
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {(() => {
            const sessionTypeTotals = analytics.reduce((acc, day) => {
              Object.entries(day.sessionTypes).forEach(([type, count]) => {
                acc[type] = (acc[type] || 0) + count;
              });
              return acc;
            }, {} as Record<string, number>);
            const maxSessions = Math.max(...Object.values(sessionTypeTotals), 1);
            const entries = Object.entries(sessionTypeTotals);
            
            if (entries.length === 0) {
              return (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No session data yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Start a focus session to see breakdown</p>
                </div>
              );
            }

            const colors = [
              'from-violet-600 to-purple-500',
              'from-fuchsia-600 to-pink-500',
              'from-indigo-600 to-violet-500',
              'from-pink-600 to-rose-500',
            ];

            return (
              <div className="h-48 flex items-end justify-center gap-8">
                {entries.map(([type, count], index) => (
                  <div key={type} className="flex flex-col items-center gap-3 group">
                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{count}</span>
                    <div className="relative w-16 h-36 bg-violet-100 dark:bg-violet-900/30 rounded-xl overflow-hidden">
                      <div className={`absolute bottom-0 w-full bg-gradient-to-t ${colors[index % colors.length]} rounded-xl transition-all duration-1000 group-hover:shadow-lg group-hover:shadow-violet-500/30`}
                        style={{ height: `${(count / maxSessions) * 100}%`, animationDelay: `${index * 150}ms` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground capitalize">{type}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Weekly Insights */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-amber-500" />
            Weekly Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-muted-foreground">Most Productive Day</p>
              <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {analytics.length > 0 ? getDateLabel(analytics.reduce((max, day) => day.studyHours > max.studyHours ? day : max).date) : 'No data'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <p className="text-sm font-medium text-muted-foreground">Daily Average</p>
              <p className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {analytics.length > 0 ? `${(totalStudyHours / analytics.length).toFixed(1)}h/day` : '0h/day'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
              <p className="text-sm font-medium text-muted-foreground">Sessions per Day</p>
              <p className="text-xl font-bold mt-1 text-violet-600 dark:text-violet-400">
                {analytics.length > 0 ? `${(totalSessions / analytics.length).toFixed(1)} avg` : '0 avg'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
