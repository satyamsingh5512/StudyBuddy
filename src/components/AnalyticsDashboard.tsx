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

      {/* Study Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Study Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.map((day, index) => (
              <div key={day.date} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{getDateLabel(day.date)}</span>
                  <span className="text-muted-foreground">
                    {day.studyHours.toFixed(1)}h
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{ 
                      width: `${(day.studyHours / maxHours) * 100}%`,
                      animationDelay: `${index * 100}ms`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tasks Completed Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Daily Tasks Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.map((day, index) => (
              <div key={`tasks-${day.date}`} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{getDateLabel(day.date)}</span>
                  <span className="text-muted-foreground">
                    {day.tasksCompleted} tasks
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                    style={{ 
                      width: `${(day.tasksCompleted / maxTasks) * 100}%`,
                      animationDelay: `${index * 100}ms`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Types Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Focus Session Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              const sessionTypeTotals = analytics.reduce((acc, day) => {
                Object.entries(day.sessionTypes).forEach(([type, count]) => {
                  acc[type] = (acc[type] || 0) + count;
                });
                return acc;
              }, {} as Record<string, number>);

              const maxSessions = Math.max(...Object.values(sessionTypeTotals), 1);
              
              return Object.entries(sessionTypeTotals).map(([type, count]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{type}</span>
                    <span className="text-muted-foreground">{count} sessions</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${(count / maxSessions) * 100}%` }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
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