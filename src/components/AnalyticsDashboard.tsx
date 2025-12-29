import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { apiFetch } from '@/config/api';
import { formatTime } from '@/lib/utils';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react';

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
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/timer/analytics?days=${timeRange}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalStudyHours = analytics.reduce((sum, day) => sum + day.studyHours, 0);
  const totalTasks = analytics.reduce((sum, day) => sum + day.tasksCompleted, 0);
  const totalSessions = analytics.reduce((sum, day) => sum + day.sessions, 0);
  const avgUnderstanding = analytics.length > 0 
    ? analytics.reduce((sum, day) => sum + day.understanding, 0) / analytics.length 
    : 0;

  const maxHours = Math.max(...analytics.map(d => d.studyHours), 1);
  const maxTasks = Math.max(...analytics.map(d => d.tasksCompleted), 1);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Study Analytics</h2>
          <p className="text-muted-foreground">Track your learning progress</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <Button
              key={days}
              variant={timeRange === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Study Time</p>
                <p className="text-2xl font-bold">{formatTime(Math.round(totalStudyHours * 3600))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Focus Sessions</p>
                <p className="text-2xl font-bold">{totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Understanding</p>
                <p className="text-2xl font-bold">{avgUnderstanding.toFixed(1)}/10</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Hours Chart - Vertical Bars */}
      <Card className="border-2 border-blue-100 dark:border-blue-900/30">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <BarChart3 className="h-5 w-5" />
            Daily Study Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 flex items-end justify-between gap-3 p-6 bg-gradient-to-t from-blue-50/50 to-transparent dark:from-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            {analytics.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-3 flex-1 group">
                {/* Vertical Bar */}
                <div className="relative w-full max-w-14 h-52 bg-gradient-to-t from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg overflow-hidden shadow-sm border border-blue-200/50 dark:border-blue-800/30">
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 transition-all duration-1000 ease-out rounded-lg shadow-lg group-hover:shadow-blue-300/50 dark:group-hover:shadow-blue-600/30"
                    style={{ 
                      height: `${(day.studyHours / maxHours) * 100}%`,
                      animationDelay: `${index * 200}ms`
                    }}
                  />
                  {/* Glow Effect */}
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-400/60 to-transparent blur-sm transition-all duration-1000"
                    style={{ 
                      height: `${(day.studyHours / maxHours) * 100}%`,
                      animationDelay: `${index * 200}ms`
                    }}
                  />
                  {/* Value Label */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-bold text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded-md shadow-sm border border-blue-200 dark:border-blue-700">
                    {day.studyHours > 0 ? `${day.studyHours.toFixed(1)}h` : '0h'}
                  </div>
                </div>
                
                {/* Date Label - Fixed and Enhanced */}
                <div className="text-sm font-semibold text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 min-w-0 whitespace-nowrap">
                  {getDateLabel(day.date).split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Combined Progress Overview - Vertical Bars */}
      <Card className="border-2 border-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30">
        <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-blue-950/30">
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="h-5 w-5" />
            Daily Progress Overview
          </CardTitle>
          <div className="flex items-center gap-6 text-sm mt-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-md shadow-sm"></div>
              <span className="font-medium text-blue-700 dark:text-blue-300">Study Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-md shadow-sm"></div>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Tasks Completed</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 flex items-end justify-between gap-2 sm:gap-3 p-6 bg-gradient-to-t from-emerald-50/30 via-teal-50/20 to-blue-50/30 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-blue-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            {analytics.map((day, index) => (
              <div key={`combined-${day.date}`} className="flex flex-col items-center gap-3 flex-1 group">
                {/* Dual Vertical Bars */}
                <div className="flex gap-2 items-end h-52">
                  {/* Study Hours Bar */}
                  <div className="relative w-5 sm:w-7 bg-gradient-to-t from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg overflow-hidden shadow-sm border border-blue-200/50 dark:border-blue-800/30">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 transition-all duration-1000 ease-out rounded-lg shadow-md group-hover:shadow-blue-300/50 dark:group-hover:shadow-blue-600/30"
                      style={{ 
                        height: `${(day.studyHours / maxHours) * 100}%`,
                        animationDelay: `${index * 200}ms`
                      }}
                    />
                    {/* Glow Effect */}
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-400/40 to-transparent blur-sm transition-all duration-1000"
                      style={{ 
                        height: `${(day.studyHours / maxHours) * 100}%`,
                        animationDelay: `${index * 200}ms`
                      }}
                    />
                  </div>
                  
                  {/* Tasks Bar */}
                  <div className="relative w-5 sm:w-7 bg-gradient-to-t from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-lg overflow-hidden shadow-sm border border-emerald-200/50 dark:border-emerald-800/30">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 transition-all duration-1000 ease-out rounded-lg shadow-md group-hover:shadow-emerald-300/50 dark:group-hover:shadow-emerald-600/30"
                      style={{ 
                        height: `${(day.tasksCompleted / maxTasks) * 100}%`,
                        animationDelay: `${index * 200 + 100}ms`
                      }}
                    />
                    {/* Glow Effect */}
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-400/40 to-transparent blur-sm transition-all duration-1000"
                      style={{ 
                        height: `${(day.tasksCompleted / maxTasks) * 100}%`,
                        animationDelay: `${index * 200 + 100}ms`
                      }}
                    />
                  </div>
                </div>
                
                {/* Values */}
                <div className="text-xs text-center font-medium">
                  <div className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md mb-1 border border-blue-200 dark:border-blue-800">
                    {day.studyHours.toFixed(1)}h
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {day.tasksCompleted} tasks
                  </div>
                </div>
                
                {/* Date Label - Enhanced */}
                <div className="text-sm font-semibold text-center text-gray-700 dark:text-gray-300 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/30 dark:to-blue-900/30 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 min-w-0 whitespace-nowrap shadow-sm">
                  {getDateLabel(day.date).split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Types Breakdown - Vertical Bars */}
      <Card className="border-2 border-purple-100 dark:border-purple-900/30">
        <CardHeader className="bg-gradient-to-r from-purple-50 via-pink-50 to-violet-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-violet-950/30">
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Activity className="h-5 w-5" />
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
            const sessionEntries = Object.entries(sessionTypeTotals);
            
            if (sessionEntries.length === 0) {
              return (
                <div className="text-center py-8 text-purple-600/60 dark:text-purple-400/60 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30 p-6">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-purple-400/50" />
                  <p className="font-medium">No session data available</p>
                  <p className="text-sm mt-1">Start a focus session to see your session types breakdown</p>
                </div>
              );
            }

            const colors = [
              { from: 'from-purple-600', via: 'via-purple-500', to: 'to-purple-400', glow: 'from-purple-400/60' },
              { from: 'from-pink-600', via: 'via-pink-500', to: 'to-pink-400', glow: 'from-pink-400/60' },
              { from: 'from-violet-600', via: 'via-violet-500', to: 'to-violet-400', glow: 'from-violet-400/60' },
              { from: 'from-indigo-600', via: 'via-indigo-500', to: 'to-indigo-400', glow: 'from-indigo-400/60' },
              { from: 'from-fuchsia-600', via: 'via-fuchsia-500', to: 'to-fuchsia-400', glow: 'from-fuchsia-400/60' }
            ];

            return (
              <div className="h-64 flex items-end justify-center gap-6 p-6 bg-gradient-to-t from-purple-50/50 via-pink-50/30 to-transparent dark:from-purple-950/20 dark:via-pink-950/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                {sessionEntries.map(([type, count], index) => {
                  const colorSet = colors[index % colors.length];
                  return (
                    <div key={type} className="flex flex-col items-center gap-3 group">
                      {/* Vertical Bar */}
                      <div className="relative w-16 h-48 bg-gradient-to-t from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-lg overflow-hidden shadow-sm border border-purple-200/50 dark:border-purple-800/30">
                        <div
                          className={`absolute bottom-0 w-full bg-gradient-to-t ${colorSet.from} ${colorSet.via} ${colorSet.to} transition-all duration-1000 ease-out rounded-lg shadow-lg group-hover:shadow-purple-300/50 dark:group-hover:shadow-purple-600/30`}
                          style={{ 
                            height: `${(count / maxSessions) * 100}%`,
                            animationDelay: `${index * 200}ms`
                          }}
                        />
                        {/* Glow Effect */}
                        <div
                          className={`absolute bottom-0 w-full bg-gradient-to-t ${colorSet.glow} to-transparent blur-sm transition-all duration-1000`}
                          style={{ 
                            height: `${(count / maxSessions) * 100}%`,
                            animationDelay: `${index * 200}ms`
                          }}
                        />
                        {/* Value Label */}
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-bold text-purple-700 dark:text-purple-300 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded-md shadow-sm border border-purple-200 dark:border-purple-700">
                          {count}
                        </div>
                      </div>
                      
                      {/* Type Label */}
                      <div className="text-sm font-semibold text-center text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 capitalize min-w-0 whitespace-nowrap">
                        {type}
                      </div>
                    </div>
                  );
                })}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Most Productive Day</p>
              <p className="text-lg">
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
              <p className="text-sm font-medium">Daily Average</p>
              <p className="text-lg">
                {analytics.length > 0 
                  ? `${(totalStudyHours / analytics.length).toFixed(1)}h/day`
                  : '0h/day'
                }
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Sessions per Day</p>
              <p className="text-lg">
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