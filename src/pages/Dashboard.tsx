import { useState, useEffect } from 'react';
import { Plus, Sparkles, Loader2, Trash2 } from 'lucide-react';
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

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const { toast} = useToast();

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    const res = await apiFetch('/api/todos');
    if (res.ok) {
      const data = await res.json();
      setTodos(data);
    }
    setLoading(false);
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    
    const res = await apiFetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      soundManager.playAdd();
      toast({ title: 'Todo added successfully' });
    }
  };

  const generateWithAI = async () => {
    if (!newTodo.trim()) {
      toast({ title: 'Enter a prompt', description: 'Describe what you want to study', variant: 'destructive' });
      return;
    }

    setAiGenerating(true);
    try {
      const res = await apiFetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: newTodo,
          examGoal: user?.examGoal || 'exam',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewTodo('');
        fetchTodos();
        soundManager.playSuccess();
        toast({ 
          title: `Generated ${data.tasks.length} tasks!`, 
          description: 'AI created your study tasks' 
        });
      } else {
        // AI failed, create a simple manual task instead
        await addTodo();
        toast({ 
          title: 'Task added manually', 
          description: 'AI generation unavailable, created basic task',
          variant: 'default'
        });
      }
    } catch (error) {
      // Fallback to manual task creation
      await addTodo();
      toast({ 
        title: 'Task added manually', 
        description: 'AI unavailable, created basic task instead'
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
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
  };

  const deleteTodo = async (id: string) => {
    const res = await apiFetch(`/api/todos/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      soundManager.playDelete();
      fetchTodos();
      toast({ title: 'Task deleted' });
    }
  };

  const completedCount = todos.filter((t) => t.completed).length;

  // Get full name for greeting
  const displayName = user?.name || 'there';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi, {displayName}! 👋</h1>
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Add task or describe what you want to study..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addTodo()}
              />
              <Button onClick={addTodo} size="icon" title="Add task">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={generateWithAI} 
              disabled={aiGenerating || !newTodo.trim()}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Tasks with AI
                </>
              )}
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
                    className="flex items-start gap-3 p-3 rounded-md border group"
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
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
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
