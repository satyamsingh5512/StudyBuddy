import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users, TrendingUp } from 'lucide-react';
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
}

// Memoized TodoItem component to prevent unnecessary re-renders
const TodoItem = memo(
  ({
    todo,
    onToggle,
    onDelete,
  }: {
    todo: Todo;
    onToggle: (id: string, completed: boolean) => void;
    onDelete: (id: string) => void;
  }) => (
    <div className="flex items-start gap-3 p-4 rounded-xl border group hover:shadow-sm transition-all duration-200 bg-card hover:border-primary/20">
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => onToggle(todo.id, todo.completed)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
          {todo.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {todo.subject} · {todo.difficulty}
        </p>
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
  )
);
TodoItem.displayName = 'TodoItem';

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { toast } = useToast();

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/todos');
    if (res.ok) {
      const data = await res.json();
      setTodos(data);
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

    const optimisticTodo = {
      id: `temp-${Date.now()}`,
      title: newTodo.trim(),
      subject: 'General',
      difficulty: 'medium',
      questionsTarget: 10,
      completed: false,
      createdAt: new Date().toISOString(),
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
        }),
      });

      if (res.ok) {
        const realTodo = await res.json();
        // Replace temp todo with real one
        setTodos((prev) => prev.map((todo) => (todo.id === optimisticTodo.id ? realTodo : todo)));
        toast({
          title: 'Task added!',
          description: 'Press Enter to add more tasks quickly',
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
        fetchTodos();
        if (!completed) {
          soundManager.playSuccess();
          toast({ title: 'Great job! +1 point', description: 'Task completed' });
        }
      }
    },
    [fetchTodos, toast]
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

  const completedCount = useMemo(() => todos.filter((t) => t.completed).length, [todos]);

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

      <div className="grid gap-3 xs:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:scale-105 transition-transform duration-200 shadow-sm hover:shadow-md border-primary/10">
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold text-primary">
              {completedCount}/{todos.length}
            </div>
            <p className="text-xs text-muted-foreground font-medium">Tasks completed</p>
          </CardContent>
        </Card>
        <Card className="hover:scale-105 transition-transform duration-200 shadow-sm hover:shadow-md border-primary/10">
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold text-primary">{user?.totalPoints}</div>
            <p className="text-xs text-muted-foreground font-medium">Total points</p>
          </CardContent>
        </Card>
        <Card className="hover:scale-105 transition-transform duration-200 shadow-sm hover:shadow-md border-primary/10">
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold text-primary">{user?.streak}</div>
            <p className="text-xs text-muted-foreground font-medium">Day streak</p>
          </CardContent>
        </Card>
        <StudyTimer />
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
        <AnalyticsDashboard />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add task... (Press Enter to save)"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTodo();
                  }
                }}
              />
              <Button onClick={addTodo} size="icon" title="Add task">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {loading ? (
                <SkeletonList count={3} />
              ) : (
                <>
                  {todos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={toggleTodo}
                      onDelete={deleteTodo}
                    />
                  ))}
                  {todos.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No tasks yet</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
