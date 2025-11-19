import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { getDaysUntil } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { SkeletonList } from '@/components/Skeleton';
import StudyTimer from '@/components/StudyTimer';

interface Todo {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  questionsTarget: number;
  completed: boolean;
}

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    const res = await fetch('/api/todos', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTodos(data);
    }
    setLoading(false);
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: newTodo,
        subject: 'General',
        difficulty: 'medium',
        questionsTarget: 10,
      }),
    });

    if (res.ok) {
      setNewTodo('');
      fetchTodos();
      toast({ title: 'Todo added successfully' });
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed: !completed }),
    });

    if (res.ok) {
      fetchTodos();
      if (!completed) {
        toast({ title: 'Great job!', description: 'Task completed' });
      }
    }
  };

  const completedCount = todos.filter((t) => t.completed).length;
  const completionPct = todos.length > 0 ? (completedCount / todos.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {getDaysUntil(user?.examDate || '')} days until {user?.examGoal}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {completedCount}/{todos.length}
            </div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{user?.totalPoints}</div>
            <p className="text-xs text-muted-foreground">Total points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{user?.streak}</div>
            <p className="text-xs text-muted-foreground">Day streak</p>
          </CardContent>
        </Card>
        <StudyTimer />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <Button onClick={addTodo} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <SkeletonList count={3} />
            ) : (
              <>
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 p-3 rounded-md border"
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
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
                  </div>
                ))}
                {todos.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No tasks yet</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
