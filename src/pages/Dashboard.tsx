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
const TodoItem = memo(({ 
  todo, 
  onToggle, 
  onDelete 
}: { 
  todo: Todo; 
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) => (
  <div
    className="flex items-start gap-3 p-3 rounded-md border group"
  >
    <Checkbox
      checked={todo.completed}
      onCheckedChange={() => onToggle(todo.id, todo.completed)}
      className="mt-0.5"
    />
    <div className="flex-1 min-w-0">
      <p
        className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
      >
        {todo.title}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {todo.subject} · {todo.difficulty}
      </p>
    </div>
    <button
      type="button"
      onClick={() => onDelete(todo.id)}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
      title="Delete task"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </button>
  </div>
));
TodoItem.displayName = 'TodoItem';

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { toast} = useToast();

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/todos');
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
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      const res = await apiFetch('/api/todos', {
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
        setNewTodo('');
        fetchTodos();
        soundManager.playAdd();
        toast({ 
          title: 'Task added!', 
          description: 'Press Enter to add more tasks quickly' 
        });
      } else {
        throw new Error('Failed to add task');
      }
    } catch (error) {
      console.error('Error adding todo:', error);
      toast({ 
        title: 'Failed to add task', 
        description: 'Please try again',
        variant: 'destructive' 
      });
    }
  }, [newTodo, fetchTodos, toast]);

  const toggleTodo = useCallback(async (id: string, completed: boolean) => {
    const res = await apiFetch(`/api/todos/${id}`, {
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
  }, [fetchTodos, toast]);

  const deleteTodo = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/todos/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      soundManager.playDelete();
      fetchTodos();
      toast({ title: 'Task deleted' });
    }
  }, [fetchTodos, toast]);

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
        <Card>
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold">
              {completedCount}/{todos.length}
            </div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold">{user?.totalPoints}</div>
            <p className="text-xs text-muted-foreground">Total points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 xs:pt-6">
            <div className="text-xl xs:text-2xl font-bold">{user?.streak}</div>
            <p className="text-xs text-muted-foreground">Day streak</p>
          </CardContent>
        </Card>
        <StudyTimer />
      </div>

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
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
