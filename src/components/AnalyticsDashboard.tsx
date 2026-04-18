import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Target,
  TrendingUp,
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { apiFetch } from '@/config/api';
import { formatTime } from '@/lib/utils';

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
  user?: { totalStudyMinutes: number };
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toSafeDate = (value: unknown, fallbackDate: Date): string => {
  const fallback = fallbackDate.toISOString().split('T')[0];

  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().split('T')[0];
};

export default function AnalyticsDashboard({ className, user }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiFetch(`/timer/analytics?days=${timeRange}&timezone=${encodeURIComponent(timezone)}`);
      if (res.ok) {
        const payload = await res.json();
        const rows = Array.isArray(payload) ? payload : [];

        const cleanData = rows
          .map((day: any, index: number): AnalyticsData => {
            const fallbackDate = new Date();
            fallbackDate.setHours(0, 0, 0, 0);
            fallbackDate.setDate(fallbackDate.getDate() - (rows.length - 1 - index));

            const rawSessionTypes = day && typeof day.sessionTypes === 'object' && day.sessionTypes !== null
              ? day.sessionTypes
              : {};

            return {
              date: toSafeDate(day?.date, fallbackDate),
              studyHours: Math.max(0, toFiniteNumber(day?.studyHours)),
              tasksCompleted: Math.max(0, Math.round(toFiniteNumber(day?.tasksCompleted))),
              understanding: Math.max(0, Math.min(10, toFiniteNumber(day?.understanding))),
              sessions: Math.max(0, Math.round(toFiniteNumber(day?.sessions))),
              sessionTypes: Object.fromEntries(
                Object.entries(rawSessionTypes).map(([key, value]) => {
                  const safeKey = key.trim() || 'General';
                  const safeValue = Math.max(0, Math.round(toFiniteNumber(value)));
                  return [safeKey, safeValue];
                })
              ),
            };
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setAnalytics(cleanData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const onTimerSaved = () => {
      fetchAnalytics();
    };

    window.addEventListener('studybuddy:timer-session-saved', onTimerSaved);
    return () => {
      window.removeEventListener('studybuddy:timer-session-saved', onTimerSaved);
    };
  }, [fetchAnalytics]);

  const totalStudyHours = analytics.reduce((sum, day) => sum + day.studyHours, 0);
  const totalTasks = analytics.reduce((sum, day) => sum + day.tasksCompleted, 0);
  const totalSessions = analytics.reduce((sum, day) => sum + day.sessions, 0);
  const avgUnderstanding = analytics.length > 0
    ? analytics.reduce((sum, day) => sum + day.understanding, 0) / analytics.length
    : 0;
  const hasStudyActivity = analytics.some((day) => day.studyHours > 0);
  const hasProgressActivity = analytics.some((day) => day.studyHours > 0 || day.tasksCompleted > 0);

  const maxHours = Math.max(...analytics.map(d => d.studyHours), 1);
  const maxTasks = Math.max(...analytics.map(d => d.tasksCompleted), 1);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'N/A';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header - RESPONSIVE FIX: Stack on mobile, flex on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-bold" style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}>Study Analytics</h2>
          <p className="text-muted-foreground" style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Track your learning progress</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <Button
              key={days}
              variant={timeRange === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(days)}
              className="min-h-[44px] min-w-[44px]"
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards - RESPONSIVE FIX: CSS Grid with auto-fit */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Study Time</p>
                <p className="font-bold" style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}>{user ? formatTime(user.totalStudyMinutes * 60) : formatTime(Math.round(totalStudyHours * 3600))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Tasks Completed</p>
                <p className="font-bold" style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}>{totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Focus Sessions</p>
                <p className="font-bold" style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}>{totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Avg Understanding</p>
                <p className="font-bold" style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}>{avgUnderstanding.toFixed(1)}/10</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Hours Chart - Histogram Style - RESPONSIVE FIX */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>Daily Study Hours</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {!hasStudyActivity && (
            <div className="mb-3 rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              No study activity recorded in this range yet. Start a timer session to populate this chart.
            </div>
          )}
          {/* RESPONSIVE FIX: Reduced height on mobile, flexible on desktop */}
          <div className="flex items-end justify-between gap-1 sm:gap-2 p-2 sm:p-4 bg-muted/30 rounded-lg" style={{ height: 'clamp(200px, 40vw, 256px)' }}>
            {analytics.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group min-w-0">
                {/* Value Label - RESPONSIVE FIX: Smaller text on mobile */}
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                  {day.studyHours > 0 ? `${day.studyHours.toFixed(1)}h` : '0h'}
                </div>
                {/* Histogram Bar - RESPONSIVE FIX: Flexible height */}
                <div className="relative w-full max-w-8 sm:max-w-12 bg-muted/50 rounded-sm overflow-hidden" style={{ height: 'clamp(100px, 25vw, 176px)' }}>
                  <div
                    className="absolute bottom-0 w-full bg-foreground/80 dark:bg-foreground/70 transition-all duration-700 ease-out rounded-sm"
                    style={{
                      height: `${(day.studyHours / maxHours) * 100}%`,
                      animationDelay: `${index * 100}ms`
                    }}
                  />
                </div>
                {/* Date Label - RESPONSIVE FIX: Smaller text on mobile */}
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground text-center truncate w-full">
                  {getDateLabel(day.date).split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Combined Progress Overview - Histogram Style - RESPONSIVE FIX */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>Daily Progress Overview</span>
          </CardTitle>
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-foreground/80 rounded-sm" />
              <span className="text-muted-foreground">Study Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-foreground/40 rounded-sm" />
              <span className="text-muted-foreground">Tasks Completed</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {!hasProgressActivity && (
            <div className="mb-3 rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              No completed study or task activity found in this range yet.
            </div>
          )}
          <div className="flex items-end justify-between gap-1 sm:gap-2 p-2 sm:p-4 bg-muted/30 rounded-lg" style={{ height: 'clamp(200px, 40vw, 256px)' }}>
            {analytics.map((day, index) => (
              <div key={`combined-${day.date}`} className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group min-w-0">
                {/* Dual Histogram Bars - RESPONSIVE FIX: Flexible height */}
                <div className="flex gap-0.5 sm:gap-1 items-end" style={{ height: 'clamp(100px, 25vw, 176px)' }}>
                  {/* Study Hours Bar */}
                  <div className="relative w-3 sm:w-4 md:w-5 bg-muted/50 rounded-sm overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 w-full bg-foreground/80 dark:bg-foreground/70 transition-all duration-700 ease-out rounded-sm"
                      style={{
                        height: `${(day.studyHours / maxHours) * 100}%`,
                        animationDelay: `${index * 100}ms`
                      }}
                    />
                  </div>
                  {/* Tasks Bar */}
                  <div className="relative w-3 sm:w-4 md:w-5 bg-muted/50 rounded-sm overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 w-full bg-foreground/40 dark:bg-foreground/30 transition-all duration-700 ease-out rounded-sm"
                      style={{
                        height: `${(day.tasksCompleted / maxTasks) * 100}%`,
                        animationDelay: `${index * 100 + 50}ms`
                      }}
                    />
                  </div>
                </div>
                {/* Values - RESPONSIVE FIX: Smaller text on mobile */}
                <div className="text-[10px] sm:text-xs text-center text-muted-foreground">
                  <div>{day.studyHours.toFixed(1)}h</div>
                  <div>{day.tasksCompleted}t</div>
                </div>
                {/* Date Label - RESPONSIVE FIX: Smaller text on mobile */}
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground text-center truncate w-full">
                  {getDateLabel(day.date).split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subjects Breakdown - Histogram Style - RESPONSIVE FIX */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>Focus Subjects</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {(() => {
            const sessionTypeTotals = analytics.reduce((acc, day) => {
              Object.entries(day.sessionTypes).forEach(([type, count]) => {
                acc[type] = (acc[type] || 0) + count;
              });
              return acc;
            }, {} as Record<string, number>);

            const maxSessions = Math.max(...Object.values(sessionTypeTotals), 1);
            const sessionEntries = Object.entries(sessionTypeTotals);

            if (sessionEntries.length === 0) {
              return (
                <div className="text-center py-6 sm:py-8 text-muted-foreground bg-muted/30 rounded-lg p-4 sm:p-6">
                  <Activity className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium" style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>No subject data available</p>
                  <p className="text-xs sm:text-sm mt-1">Start a focus session with a subject to see your breakdown</p>
                </div>
              );
            }

            return (
              <div className="flex items-end justify-center gap-4 sm:gap-8 p-2 sm:p-4 bg-muted/30 rounded-lg" style={{ height: 'clamp(180px, 35vw, 224px)' }}>
                {sessionEntries.map(([type, count], index) => (
                  <div key={type} className="flex flex-col items-center gap-1 sm:gap-2 group">
                    {/* Value Label - RESPONSIVE FIX: Smaller text on mobile */}
                    <div className="text-xs sm:text-sm font-bold text-foreground">
                      {count}
                    </div>
                    {/* Histogram Bar - RESPONSIVE FIX: Flexible dimensions */}
                    <div className="relative bg-muted/50 rounded-sm overflow-hidden" style={{ width: 'clamp(2.5rem, 8vw, 3.5rem)', height: 'clamp(120px, 28vw, 160px)' }}>
                      <div
                        className="absolute bottom-0 w-full bg-foreground/80 dark:bg-foreground/70 transition-all duration-700 ease-out rounded-sm"
                        style={{
                          height: `${(count / maxSessions) * 100}%`,
                          animationDelay: `${index * 100}ms`
                        }}
                      />
                    </div>
                    {/* Type Label - RESPONSIVE FIX: Smaller text on mobile */}
                    <div className="text-[10px] sm:text-xs font-medium text-muted-foreground capitalize truncate max-w-[60px] sm:max-w-none">
                      {type}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Weekly Summary - RESPONSIVE FIX: CSS Grid with auto-fit */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Most Productive Day</p>
              <p className="text-lg font-semibold">
                {analytics.length > 0
                  ? getDateLabel(
                    analytics.reduce((max, day) =>
                      day.studyHours > max.studyHours ? day : max
                    ).date
                  )
                  : 'No data'
                }
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Daily Average</p>
              <p className="text-lg font-semibold">
                {analytics.length > 0
                  ? `${(totalStudyHours / analytics.length).toFixed(1)}h/day`
                  : '0h/day'
                }
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Sessions per Day</p>
              <p className="text-lg font-semibold">
                {analytics.length > 0
                  ? `${(totalSessions / analytics.length).toFixed(1)} avg`
                  : '0 avg'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
