import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users, TrendingUp, RotateCcw, Calendar, AlertCircle, CheckCircle2, Target, Flame, Trophy, Clock } from 'lucide-react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { getDaysUntil } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { SkeletonList } from '@/components/Skeleton';
import StudyTimer from '@/components/StudyTimer';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';

interface Todo {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  questionsTarget: number;
  completed: boolean;
  scheduledDate?: string;
  createdAt?: string;
  isOverdue?: boolean;
  rescheduledCount?: number;
  originalScheduledDate?: string;
}

// Helper to format date nicely
const formatScheduledDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'No date';
  
  const date = new Date(dateStr);
  
  // Check for invalid date
  if (isNaN(date.getTime())) return 'No date';
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} overdue`;
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Memoized TodoItem component to prevent unnecessary re-renders
const TodoItem = memo(
  ({
    todo,
    onToggle,
    onDelete,
    onRescheduleToday,
    onReschedule,
  }: {
    todo: Todo;
    onToggle: (id: string, completed: boolean) => void;
    onDelete: (id: string) => void;
    onRescheduleToday: (id: string) => void;
    onReschedule: (id: string) => void;
  }) => {
    const isOverdue = todo.isOverdue && !todo.completed;
    
    return (
      <div className={`flex items-start gap-3 p-4 rounded-xl border group hover:shadow-sm transition-all duration-200 bg-card hover:border-primary/20 ${
        isOverdue ? 'opacity-70 border-rose-300/50 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10' : ''
      } ${todo.completed ? 'opacity-50' : ''}`}>
        <Checkbox
          checked={todo.completed}
          onCheckedChange={() => onToggle(todo.id, todo.completed)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
            {todo.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {todo.subject} · {todo.difficulty}
            </p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
              isOverdue 
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <Calendar className="h-3 w-3" />
              {formatScheduledDate(todo.scheduledDate)}
            </span>
            {(() => {
              const count = typeof todo.rescheduledCount === 'number' ? todo.rescheduledCount : 
                           (typeof todo.rescheduledCount === 'object' && todo.rescheduledCount && 'increment' in todo.rescheduledCount && typeof (todo.rescheduledCount as any).increment === 'number' ? (todo.rescheduledCount as any).increment : 0);
              return count > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <RotateCcw className="h-3 w-3" />
                  {count}x
                </span>
              );
            })()}
          </div>
          
          {/* Overdue task actions */}
          {isOverdue && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-800/30">
              <AlertCircle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
              <span className="text-xs text-rose-600 dark:text-rose-400">
                This task is overdue
              </span>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRescheduleToday(todo.id)}
                  className="h-6 px-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/20"
                >
                  Do today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReschedule(todo.id)}
                  className="h-6 px-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/20"
                >
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded-lg"
          title="Delete task"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      </div>
    );
  }
);
TodoItem.displayName = 'TodoItem';

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; todoId: string | null }>({
    open: false,
    todoId: null,
  });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const { toast } = useToast();

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/todos');
    if (res.ok) {
      const data = await res.json();
      // Ensure rescheduledCount is always a number
      const processedData = data.map((todo: any) => ({
        ...todo,
        rescheduledCount: typeof todo.rescheduledCount === 'number' ? todo.rescheduledCount : 0,
      }));
      setTodos(processedData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(async () => {
    if (!newTodo.trim()) {
      toast({
        title: 'Empty task',
        description: 'Please enter a task description',
        variant: 'destructive',
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: newTodo.trim(),
      subject: 'General',
      difficulty: 'medium',
      questionsTarget: 10,
      completed: false,
      scheduledDate: today.toISOString(),
      isOverdue: false,
      rescheduledCount: 0,
    };

    // Optimistic update - add immediately
    setTodos((prev) => [...prev, optimisticTodo]);
    setNewTodo('');
    soundManager.playAdd();

    try {
      const res = await apiFetch('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTodo.trim(),
          subject: 'General',
          difficulty: 'medium',
          questionsTarget: 10,
          scheduledDate: today.toISOString(),
        }),
      });

      if (res.ok) {
        const realTodo = await res.json();
        // Ensure rescheduledCount is a number
        const processedTodo = {
          ...realTodo,
          rescheduledCount: typeof realTodo.rescheduledCount === 'number' ? realTodo.rescheduledCount : 0,
        };
        // Replace temp todo with real one
        setTodos((prev) => prev.map((todo) => (todo.id === optimisticTodo.id ? processedTodo : todo)));
        toast({
          title: 'Task added for today!',
          description: 'Complete it to earn 2 points',
        });
      } else {
        throw new Error('Failed to add task');
      }
    } catch (error) {
      console.error('Error adding todo:', error);
      // Revert optimistic update on error
      setTodos((prev) => prev.filter((todo) => todo.id !== optimisticTodo.id));
      setNewTodo(newTodo.trim());
      toast({
        title: 'Failed to add task',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  }, [newTodo, toast]);

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      const res = await apiFetch(`/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });

      if (res.ok) {
        const data = await res.json();
        fetchTodos();
        if (!completed) {
          soundManager.playSuccess();
          const points = data.pointsAwarded || 0;
          let message = 'Task completed!';
          let description = 'Well done!';
          
          if (points > 0) {
            message = `Task completed! +${points} point${points === 1 ? '' : 's'}`;
            if (points === 1) {
              description = 'Completed on scheduled date!';
            } else if (points === 0.5) {
              description = 'Completed after reschedule!';
            }
          }
          
          toast({ title: message, description });
        }
      }
    },
    [fetchTodos, toast, todos]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/todos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        soundManager.playDelete();
        fetchTodos();
        toast({ title: 'Task deleted' });
      }
    },
    [fetchTodos, toast]
  );

  const rescheduleToToday = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/todos/${id}/reschedule-to-today`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        // Local update instead of full refetch
        setTodos(prev => prev.map(t => {
          if (t.id === id) {
            return {
              ...t,
              scheduledDate: new Date().toISOString(),
              isOverdue: false,
              // Assuming rescheduling increments count, though backend handles logical logic
              rescheduledCount: (t.rescheduledCount || 0) + 1
            };
          }
          return t;
        }));

        const pointsMsg = data.pointsCredited ? ` (+${data.pointsCredited} points)` : '';
        toast({ title: 'Task rescheduled to today', description: `Complete it to earn points!${pointsMsg}` });
      } else {
        toast({ title: 'Failed to reschedule', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error rescheduling task', variant: 'destructive' });
    } finally {
      setUpdatingTodoId(null);
      }
    },
    [fetchTodos, toast]
  );

  const rescheduleAllOverdue = useCallback(
    async () => {
      const res = await apiFetch('/todos/reschedule-all-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        fetchTodos();
        toast({ 
          title: 'All overdue tasks rescheduled!', 
          description: `${data.count} task${data.count > 1 ? 's' : ''} moved to today` 
        });
      } else {
        toast({ title: 'Failed to reschedule tasks', variant: 'destructive' });
      }
    },
    [fetchTodos, toast]
  );
  const openRescheduleModal = useCallback((id: string) => {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRescheduleDate(tomorrow.toISOString().split('T')[0]);
    setRescheduleModal({ open: true, todoId: id });
  }, []);

  const handleReschedule = useCallback(async () => {
    if (!rescheduleModal.todoId || !rescheduleDate) return;

    const res = await apiFetch(`/todos/${rescheduleModal.todoId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newDate: rescheduleDate }),
    });

    if (res.ok) {
      const data = await res.json();
      fetchTodos();
      setRescheduleModal({ open: false, todoId: null });
      const pointsMsg = data.pointsCredited ? ` (+${data.pointsCredited} points)` : '';
      toast({ title: 'Task rescheduled', description: `Scheduled for ${new Date(rescheduleDate).toLocaleDateString()}${pointsMsg}` });
    } else {
      toast({ title: 'Failed to reschedule', variant: 'destructive' });
    }
  }, [rescheduleModal.todoId, rescheduleDate, fetchTodos, toast]);

  const completedCount = useMemo(() => todos.filter((t) => t.completed).length, [todos]);
  const overdueCount = useMemo(() => todos.filter((t) => t.isOverdue && !t.completed).length, [todos]);
  const todaysTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return todos.filter((t) => {
      if (!t.scheduledDate || t.completed) return false;
      const scheduled = new Date(t.scheduledDate);
      if (isNaN(scheduled.getTime())) return false;
      scheduled.setHours(0, 0, 0, 0);
      return scheduled.getTime() === today.getTime();
    }).length;
  }, [todos]);

  // Get full name for greeting
  const displayName = useMemo(() => user?.name || 'there', [user?.name]);
  const daysUntilExam = useMemo(() => getDaysUntil(user?.examDate || ''), [user?.examDate]);

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {displayName}! 👋</h1>
          <p className="text-sm text-muted-foreground">
            {daysUntilExam} days until {user?.examGoal}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAnalytics(!showAnalytics)}
            onMouseEnter={() => {
              import('@/components/AnalyticsDashboard');
            }}
            onFocus={() => {
              import('@/components/AnalyticsDashboard');
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
          <Button
            onClick={() => navigate('/friends')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Find Friends</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid on Large Screens, Horizontal Scroll on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap gap-3 xs:gap-4 xl:gap-3 xl:overflow-x-auto xl:pb-2 xl:scrollbar-thin xl:scrollbar-thumb-muted xl:scrollbar-track-transparent">
        {/* Today's Tasks Card */}
        <Card className="group relative overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-lg border-primary/20 min-w-[140px] sm:min-w-[160px] xl:flex-shrink-0 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/20 dark:via-gray-900/50 dark:to-blue-950/10">
          <CardContent className="p-4 sm:p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-400/20 to-blue-600/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors duration-300">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wide">
                  Today
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                {todaysTasks}
              </div>
              <p className="text-xs sm:text-sm text-blue-600/80 dark:text-blue-400/80 font-medium">
                Active tasks
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks Card */}
        {overdueCount > 0 && (
          <Card className="group relative overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-lg border-rose-200/50 dark:border-rose-500/30 min-w-[140px] sm:min-w-[160px] xl:flex-shrink-0 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/30 dark:from-rose-950/20 dark:via-gray-900/50 dark:to-rose-950/10">
            <CardContent className="p-4 sm:p-6 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-rose-400/20 to-rose-600/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-rose-500/10 rounded-lg group-hover:bg-rose-500/20 transition-colors duration-300">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-xs font-medium text-rose-600/70 dark:text-rose-400/70 uppercase tracking-wide">
                    Overdue
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-rose-700 dark:text-rose-300 mb-1">
                  {overdueCount}
                </div>
                <p className="text-xs sm:text-sm text-rose-600/80 dark:text-rose-400/80 font-medium">
                  Need attention
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Tasks Card */}
        <Card className="group relative overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-lg border-emerald-200/50 dark:border-emerald-500/30 min-w-[140px] sm:min-w-[160px] xl:flex-shrink-0 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 dark:from-emerald-950/20 dark:via-gray-900/50 dark:to-emerald-950/10">
          <CardContent className="p-4 sm:p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors duration-300">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide">
                  Done
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                {completedCount}/{todos.length}
              </div>
              <p className="text-xs sm:text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                Completed today
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Points Card */}
        <Card className="group relative overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-lg border-amber-200/50 dark:border-amber-500/30 min-w-[140px] sm:min-w-[160px] xl:flex-shrink-0 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-gray-900/50 dark:to-amber-950/10">
          <CardContent className="p-4 sm:p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-400/20 to-amber-600/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors duration-300">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wide">
                  Points
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-300 mb-1">
                {user?.totalPoints || 0}
              </div>
              <p className="text-xs sm:text-sm text-amber-600/80 dark:text-amber-400/80 font-medium">
                Total earned
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="group relative overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-lg border-orange-200/50 dark:border-orange-500/30 min-w-[140px] sm:min-w-[160px] xl:flex-shrink-0 bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 dark:from-orange-950/20 dark:via-gray-900/50 dark:to-orange-950/10">
          <CardContent className="p-4 sm:p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-400/20 to-orange-600/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors duration-300">
                  <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-xs font-medium text-orange-600/70 dark:text-orange-400/70 uppercase tracking-wide">
                  Streak
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-orange-700 dark:text-orange-300 mb-1">
                {user?.streak || 0}
              </div>
              <p className="text-xs sm:text-sm text-orange-600/80 dark:text-orange-400/80 font-medium">
                Day streak
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Study Timer - Compact button that expands */}
        <div className="flex justify-center xl:justify-start">
          <StudyTimer />
        </div>
      </div>

      {/* Admin Panel - Only visible to admin users */}
      {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
        <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
              You have administrator privileges. Access the admin dashboard to manage users and send daily stats emails.
            </p>
            <Button
              onClick={() => navigate('/admin')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Open Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {showAnalytics ? (
        <AnalyticsDashboard user={user} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              Tasks
              {overdueCount > 0 && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                  {overdueCount} overdue
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add task for today... (Press Enter)"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTodo();
                  }
                }}
              />
              <Button onClick={addTodo} size="icon" title="Add task for today">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {loading ? (
                <SkeletonList count={3} />
              ) : (
                <>
                  {/* Show overdue tasks first with a separator */}
                  {overdueCount > 0 && (
                    <div className="pb-2 mb-2 border-b border-rose-200/50 dark:border-rose-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Overdue - Take action to reschedule or complete
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={rescheduleAllOverdue}
                          className="h-7 px-2 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reschedule all to today
                        </Button>
                      </div>
                      {todos
                        .filter((todo) => todo.isOverdue && !todo.completed)
                        .map((todo) => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onToggle={toggleTodo}
                            onDelete={deleteTodo}
                            onRescheduleToday={rescheduleToToday}
                            onReschedule={openRescheduleModal}
                          />
                        ))}
                    </div>
                  )}
                  
                  {/* Regular tasks (today and future) */}
                  {todos
                    .filter((todo) => !todo.isOverdue || todo.completed)
                    .map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        onRescheduleToday={rescheduleToToday}
                        onReschedule={openRescheduleModal}
                      />
                    ))}
                  {todos.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No tasks yet. Add one for today!
                    </p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Reschedule Task
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a new date for this task. Tasks completed on their scheduled day earn more points!
              </p>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setRescheduleModal({ open: false, todoId: null })}
                >
                  Cancel
                </Button>
                <Button onClick={handleReschedule}>
                  Reschedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
