import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users, TrendingUp, RotateCcw, Calendar, AlertCircle, CheckCircle2, Target, Flame, Trophy, Clock, Pencil, Check, X as XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDaysUntil } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { SkeletonList } from '@/components/Skeleton';
import StudyHeatmap from '@/components/StudyHeatmap';
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

// Animation variants for todo items
const todoItemVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } },
  exit: { opacity: 0, x: -30, scale: 0.95, transition: { duration: 0.2, ease: 'easeInOut' } },
};

// Memoized TodoItem component to prevent unnecessary re-renders
const TodoItem = memo(
  ({
    todo,
    onToggle,
    onDelete,
    onRescheduleToday,
    onReschedule,
    onEdit,
  }: {
    todo: Todo;
    onToggle: (id: string, completed: boolean) => void;
    onDelete: (id: string) => void;
    onRescheduleToday: (id: string) => void;
    onReschedule: (id: string) => void;
    onEdit: (id: string, updates: Partial<Todo>) => void;
  }) => {
    const isOverdue = todo.isOverdue && !todo.completed;
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(todo.title);
    const [editSubject, setEditSubject] = useState(todo.subject);
    const [editDifficulty, setEditDifficulty] = useState(todo.difficulty);
    const [editCompleted, setEditCompleted] = useState(todo.completed);

    const handleStartEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditTitle(todo.title);
      setEditSubject(todo.subject);
      setEditDifficulty(todo.difficulty);
      setEditCompleted(todo.completed);
      setIsEditing(true);
    };

    const handleSave = () => {
      if (!editTitle.trim()) return;
      onEdit(todo.id, {
        title: editTitle.trim(),
        subject: editSubject.trim() || 'General',
        difficulty: editDifficulty,
        completed: editCompleted,
      });
      setIsEditing(false);
    };

    const handleCancel = () => {
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    return (
      <motion.div
        layout
        variants={todoItemVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`rounded-lg border-b last:border-0 border-border/50 group transition-all duration-200 bg-transparent overflow-hidden ${isEditing ? 'bg-secondary/30 ring-1 ring-primary/20' : 'hover:bg-secondary/20'} ${isOverdue && !isEditing ? 'opacity-90 bg-destructive/5 dark:bg-destructive/10 border-destructive/20' : ''
          } ${todo.completed && !isEditing ? 'opacity-40' : ''}`}
      >
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="p-3 space-y-3"
            >
              {/* Edit Title */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Task title"
                  className="text-sm"
                  autoFocus
                />
              </motion.div>

              {/* Edit Subject & Difficulty */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-3"
              >
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Subject"
                    className="text-sm"
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Difficulty</label>
                  <Select value={editDifficulty} onValueChange={setEditDifficulty}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              {/* Status Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2"
              >
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <motion.button
                  type="button"
                  onClick={() => setEditCompleted(!editCompleted)}
                  whileTap={{ scale: 0.92 }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 border ${editCompleted
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700'
                    : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                    }`}
                >
                  <motion.span
                    key={editCompleted ? 'done' : 'pending'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    {editCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {editCompleted ? 'Done' : 'Pending'}
                  </motion.span>
                </motion.button>
              </motion.div>

              {/* Save / Cancel */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-2 justify-end pt-1"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 px-3 text-xs"
                >
                  <XIcon className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!editTitle.trim()}
                  className="h-8 px-3 text-xs"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="view-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-3 p-3"
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => onToggle(todo.id, todo.completed)}
                  className="mt-1 border-border/50 data-[state=checked]:bg-primary"
                />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.p
                  animate={{ opacity: todo.completed ? 0.5 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {todo.title}
                </motion.p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {todo.subject} · {todo.difficulty}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${isOverdue
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
                <AnimatePresence>
                  {isOverdue && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-800/30"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-primary/10 rounded-lg"
                  title="Edit task"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Pencil className="h-4 w-4 text-primary" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => onDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded-lg"
                  title="Delete task"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
TodoItem.displayName = 'TodoItem';

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; todoId: string | null }>({
    open: false,
    todoId: null,
  });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);
  const { toast } = useToast();

  // Silent background fetch — only shows skeleton on first load
  const fetchTodos = useCallback(async () => {
    if (!hasFetchedOnce.current) {
      setInitialLoading(true);
    }
    const res = await apiFetch('/todos');
    if (res.ok) {
      const data = await res.json();
      const processedData = data.map((todo: any) => ({
        ...todo,
        // MongoDB returns _id — map it to id for the frontend
        id: todo._id?.toString() || todo.id,
        rescheduledCount: typeof todo.rescheduledCount === 'number' ? todo.rescheduledCount : 0,
      }));
      setTodos(processedData);
    }
    if (!hasFetchedOnce.current) {
      hasFetchedOnce.current = true;
      setInitialLoading(false);
    }
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
        const processedTodo = {
          ...realTodo,
          // Remap MongoDB _id to id
          id: realTodo._id?.toString() || realTodo.id,
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
      // Optimistic update — instantly flip in UI
      setTodos(prev => prev.map(t =>
        t.id === id ? { ...t, completed: !completed, isOverdue: !completed ? false : t.isOverdue } : t
      ));

      if (!completed) {
        soundManager.playSuccess();
      }

      try {
        const res = await apiFetch(`/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !completed }),
        });

        if (res.ok) {
          const data = await res.json();
          // Silently sync server state
          fetchTodos();
          if (!completed) {
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
        } else {
          // Revert on failure
          setTodos(prev => prev.map(t =>
            t.id === id ? { ...t, completed, isOverdue: t.isOverdue } : t
          ));
          toast({ title: 'Failed to update task', variant: 'destructive' });
        }
      } catch {
        // Revert on error
        setTodos(prev => prev.map(t =>
          t.id === id ? { ...t, completed, isOverdue: t.isOverdue } : t
        ));
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [fetchTodos, toast]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      // Optimistic update — remove from list immediately (AnimatePresence will animate out)
      const previousTodos = todos;
      setTodos(prev => prev.filter(t => t.id !== id));
      soundManager.playDelete();

      try {
        const res = await apiFetch(`/todos/${id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          toast({ title: 'Task deleted' });
        } else {
          // Revert on failure
          setTodos(previousTodos);
          toast({ title: 'Failed to delete task', variant: 'destructive' });
        }
      } catch {
        // Revert on error
        setTodos(previousTodos);
        toast({ title: 'Failed to delete task', variant: 'destructive' });
      }
    },
    [todos, toast]
  );

  const rescheduleToToday = useCallback(
    async (id: string) => {
      try {
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
      const todayISO = new Date().toISOString();
      // Optimistic: move all overdue tasks to today
      setTodos(prev => prev.map(t =>
        t.isOverdue && !t.completed
          ? { ...t, scheduledDate: todayISO, isOverdue: false, rescheduledCount: (t.rescheduledCount || 0) + 1 }
          : t
      ));

      try {
        const res = await apiFetch('/todos/reschedule-all-overdue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (res.ok) {
          const data = await res.json();
          fetchTodos(); // silent background sync
          toast({
            title: 'All overdue tasks rescheduled!',
            description: `${data.count} task${data.count > 1 ? 's' : ''} moved to today`
          });
        } else {
          fetchTodos(); // revert via refetch
          toast({ title: 'Failed to reschedule tasks', variant: 'destructive' });
        }
      } catch {
        fetchTodos();
        toast({ title: 'Failed to reschedule tasks', variant: 'destructive' });
      }
    },
    [fetchTodos, toast]
  );
  const editTodo = useCallback(
    async (id: string, updates: Partial<Todo>) => {
      // Optimistic update
      const previousTodos = todos;
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      soundManager.playClick();

      try {
        const res = await apiFetch(`/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (res.ok) {
          fetchTodos(); // silent background sync
          toast({ title: 'Task updated' });
        } else {
          // Revert on failure
          setTodos(previousTodos);
          toast({ title: 'Failed to update task', variant: 'destructive' });
        }
      } catch {
        setTodos(previousTodos);
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [todos, fetchTodos, toast]
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
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap gap-4 xs:gap-6 xl:gap-8 xl:overflow-x-auto xl:pb-4 xl:scrollbar-thin xl:scrollbar-thumb-muted xl:scrollbar-track-transparent">
        {/* Today's Tasks Card */}
        <Card className="group relative overflow-hidden bg-card/80 backdrop-blur-2xl hover:scale-[1.02] transition-all duration-300 border-border/50 min-w-[140px] sm:min-w-[180px] xl:flex-shrink-0 shadow-lg hover:shadow-primary/5">
          <CardContent className="p-5 sm:p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 border border-border/50 bg-background/50 rounded-lg group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors duration-300">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:animate-pulse" />
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Today
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-primary transition-colors">
                    {todaysTasks}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Active tasks
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks Card */}
        {overdueCount > 0 && (
          <Card className="group relative overflow-hidden bg-card/80 backdrop-blur-2xl hover:scale-[1.02] transition-all duration-300 border-destructive/20 min-w-[140px] sm:min-w-[180px] xl:flex-shrink-0 shadow-lg hover:shadow-destructive/5 line-through-animation">
            <CardContent className="p-5 sm:p-6 relative h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 border border-destructive/20 bg-destructive/5 rounded-lg group-hover:bg-destructive/10 transition-colors duration-300">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                  </div>
                  <div className="text-[10px] font-bold text-destructive uppercase tracking-widest">
                    Overdue
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-destructive">
                      {overdueCount}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                    Need attention
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Tasks Card */}
        <Card className="group relative overflow-hidden bg-card/80 backdrop-blur-2xl hover:scale-[1.02] transition-all duration-300 border-border/50 min-w-[140px] sm:min-w-[180px] xl:flex-shrink-0 shadow-lg hover:shadow-success/5">
          <CardContent className="p-5 sm:p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 border border-border/50 bg-background/50 rounded-lg group-hover:bg-success/10 group-hover:border-success/20 transition-colors duration-300">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Done
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-success transition-colors">
                    {completedCount}
                  </span>
                  <span className="text-sm font-bold font-mono text-muted-foreground">/{todos.length}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Completed today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Points Card */}
        <Card className="group relative overflow-hidden bg-card/80 backdrop-blur-2xl hover:scale-[1.02] transition-all duration-300 border-border/50 min-w-[140px] sm:min-w-[180px] xl:flex-shrink-0 shadow-lg hover:shadow-accent/5">
          <CardContent className="p-5 sm:p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 border border-border/50 bg-background/50 rounded-lg group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors duration-300">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Points
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-accent transition-colors">
                    {user?.totalPoints || 0}
                  </span>
                  <span className="text-sm font-bold font-mono text-muted-foreground">XP</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Total earned
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="group relative overflow-hidden bg-card/80 backdrop-blur-2xl hover:scale-[1.02] transition-all duration-300 border-border/50 min-w-[140px] sm:min-w-[180px] xl:flex-shrink-0 shadow-lg hover:shadow-accent/5">
          <CardContent className="p-5 sm:p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 border border-border/50 bg-background/50 rounded-lg group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors duration-300">
                  <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Streak
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-accent transition-colors">
                    {user?.streak || 0}
                  </span>
                  <span className="text-sm font-bold font-mono text-muted-foreground">Days</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Active streak
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anchored Study Timer Component (Floating out-of-flow beside stats) */}
        <div className="absolute top-[200px] right-2 sm:right-6 lg:right-10 z-[100] xl:static xl:ml-auto">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-2xl shadow-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <span className="flex items-center gap-2 text-foreground">
                  <Target className="h-4 w-4 text-primary" /> Active Objectives
                </span>
                {overdueCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive uppercase tracking-widest ml-2">
                    {overdueCount} overdue
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex gap-2 relative">
                <Input
                  placeholder="Press Enter to add new task..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTodo();
                    }
                  }}
                  className="bg-transparent border-t-0 border-l-0 border-r-0 border-b-2 border-border/50 rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 text-sm font-medium transition-all"
                />
                <Button onClick={addTodo} size="icon" variant="ghost" title="Add task" className="absolute right-0 hover:bg-transparent hover:text-primary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {initialLoading ? (
                  <SkeletonList count={3} />
                ) : (
                  <>
                    {/* Show overdue tasks first with a separator */}
                    <AnimatePresence mode="popLayout">
                      {overdueCount > 0 && (
                        <motion.div
                          key="overdue-section"
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          className="pb-2 mb-2 border-b border-rose-200/50 dark:border-rose-800/30"
                        >
                          <div className="flex items-center justify-between mb-3 bg-destructive/10 border border-destructive/20 rounded-md p-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-destructive flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4" />
                              Overdue Action Required
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={rescheduleAllOverdue}
                              className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Move to Today
                            </Button>
                          </div>
                          <AnimatePresence mode="popLayout">
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
                                  onEdit={editTodo}
                                />
                              ))}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Regular tasks (today and future) */}
                    <AnimatePresence mode="popLayout">
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
                            onEdit={editTodo}
                          />
                        ))}
                    </AnimatePresence>
                    <AnimatePresence>
                      {todos.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-center py-12"
                        >
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-4">
                            <Target className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">No active objectives</h3>
                          <p className="text-xs text-muted-foreground">Add a task above to start earning points</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Heatmap Wow Factor */}
          <div className="lg:sticky lg:top-24 h-fit">
            <StudyHeatmap />
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="w-full max-w-md"
            >
              <Card className="border-border/50 bg-card shadow-2xl">
                <CardHeader className="border-b border-border/50 pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Calendar className="h-4 w-4 text-primary" />
                    Reschedule Objective
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose a new date for this task. Tasks completed on their scheduled day earn more XP.
                  </p>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-secondary/50 border-border/50 focus-visible:ring-primary/20"
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setRescheduleModal({ open: false, todoId: null })}
                      className="text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleReschedule} className="text-xs font-semibold">
                      Confirm Reschedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
