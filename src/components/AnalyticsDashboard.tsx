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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Study Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2 p-4 bg-muted/20 rounded-lg">
            {analytics.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
                {/* Vertical Bar */}
                <div className="relative w-full max-w-12 h-48 bg-muted/30 rounded-t-md overflow-hidden">
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-700 rounded-t-md"
                    style={{ 
                      height: `${(day.studyHours / maxHours) * 100}%`,
                      animationDelay: `${index * 150}ms`
                    }}
                  />
                  {/* Value Label */}
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground">
                    {day.studyHours > 0 ? `${day.studyHours.toFixed(1)}h` : ''}
                  </div>
                </div>
                
                {/* Date Label */}
                <div className="text-xs font-medium text-center text-muted-foreground rotate-0 sm:rotate-45 origin-center">
                  {getDateLabel(day.date).split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Combined Progress Overview - Vertical Bars */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Progress Overview
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-t from-blue-500 to-blue-400 rounded"></div>
              <span>Study Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-t from-green-500 to-green-400 rounded"></div>
              <span>Tasks Completed</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-1 sm:gap-2 p-4 bg-muted/20 rounded-lg">
            {analytics.map((day, index) => (
              <div key={`combined-${day.date}`} className="flex flex-col items-center gap-2 flex-1">
                {/* Dual Vertical Bars */}
                <div className="flex gap-1 items-end h-48">
                  {/* Study Hours Bar */}
                  <div className="relative w-4 sm:w-6 bg-muted/30 rounded-t-sm overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-700 rounded-t-sm"
                      style={{ 
                        height: `${(day.studyHours / maxHours) * 100}%`,
                        animationDelay: `${index * 150}ms`
                      }}
                    />
                  </div>
                  
                  {/* Tasks Bar */}
                  <div className="relative w-4 sm:w-6 bg-muted/30 rounded-t-sm overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 to-green-400 transition-all duration-700 rounded-t-sm"
                      style={{ 
                        height: `${(day.tasksCompleted / maxTasks) * 100}%`,
                        animationDelay: `${index * 150 + 75}ms`
                      }}
                    />
                  </div>
                </div>
                
                {/* Values */}
                <div className="text-xs text-center text-muted-foreground">
                  <div>{day.studyHours.toFixed(1)}h</div>
                  <div>{day.tasksCompleted} tasks</div>
                </div>
                
                {/* Date Label */}
                <div className="text-xs font-medium text-center text-muted-foreground">
                  {getDateLabel(day.date).split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Types Breakdown - Vertical Bars */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Focus Session Types
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                <div className="text-center py-8 text-muted-foreground">
                  No session data available
                </div>
              );
            }

            return (
              <div className="h-48 flex items-end justify-center gap-4 p-4 bg-muted/20 rounded-lg">
                {sessionEntries.map(([type, count], index) => (
                  <div key={type} className="flex flex-col items-center gap-2">
                    {/* Vertical Bar */}
                    <div className="relative w-16 h-32 bg-muted/30 rounded-t-md overflow-hidden">
                      <div
                        className="absolute bottom-0 w-full bg-gradient-to-t from-purple-500 to-pink-400 transition-all duration-700 rounded-t-md"
                        style={{ 
                          height: `${(count / maxSessions) * 100}%`,
                          animationDelay: `${index * 200}ms`
                        }}
                      />
                      {/* Value Label */}
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-muted-foreground">
                        {count}
                      </div>
                    </div>
                    
                    {/* Type Label */}
                    <div className="text-xs font-medium text-center text-muted-foreground capitalize">
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