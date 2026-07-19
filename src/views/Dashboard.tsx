import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useNavigate } from '@/lib/router';
import { Plus, Trash2, Users, TrendingUp, RotateCcw, Calendar, AlertCircle, CheckCircle2, Target, Flame, Trophy, Pencil, Check, X as XIcon, GripVertical, Gauge } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import {
  GlassCard as Card,
  GlassCardContent as CardContent,
  GlassCardHeader as CardHeader,
  GlassCardTitle as CardTitle,
  GlassButton,
  GlassModal,
  AmbientBackground,
} from '@/components/dashboard/glass';
import {
  Card as SolidCard,
  CardContent as SolidCardContent,
  CardHeader as SolidCardHeader,
  CardTitle as SolidCardTitle,
} from '@/components/ui/card';
import { staggerContainer, getRiseItem, springSnappy } from '@/lib/motion';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDaysUntil } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { SkeletonList } from '@/components/Skeleton';
import StudyTimer from '@/components/StudyTimer';
import { useTodos, useDailyEfficiency, useCreateTodo, useUpdateTodo, useDeleteTodo, useDeleteTodosByDay, useRescheduleTodo, useRescheduleAllOverdue, useToggleTodo, useRescheduleTodoToToday } from '@/lib/queries';
import { soundManager } from '@/lib/sounds';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const StudyHeatmap = dynamic(() => import('@/components/StudyHeatmap'), {
  loading: () => <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" aria-label="Loading consistency activity" />,
});
const AnalyticsDashboard = dynamic(() => import('@/components/AnalyticsDashboard'), {
  loading: () => <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" aria-label="Loading analytics" />,
});

/** Stat tiles inside the stats row are intentionally NOT individually glass.
 * Performance budget: capping simultaneous backdrop-filter layers at ~6-8 per
 * viewport means 6 independently-blurred stat cards would already eat most
 * of the budget before the todo panel, heatmap, or analytics cards render.
 * Instead the whole row shares ONE glass shell (`sbd-glass--card` on the
 * row wrapper below) and each tile is a plain motion.div — same stagger/
 * hover-lift feel, one blur layer instead of six. */
const MotionCard = motion.div;

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
  source?: string;
  startTime?: string;
  endTime?: string;
}

interface DailyEfficiency {
  date: string;
  scheduledTasks: number;
  completedTasks: number;
  taskCompletionPct: number;
  timerStarts: number;
  timerCompletedSessions: number;
  timerUsedMinutes: number;
  timerTimeTakenMinutes: number;
  timerStartCompletionPct: number;
  timerUsagePct: number;
  timerMinutesPct: number;
  abandonedTimerStarts: number;
  strictPenaltyPoints: number;
  overallEfficiencyPct: number;
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

const difficultyConfig: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  hard: { label: 'Hard', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

const difficultyPriorityScore: Record<string, number> = {
  hard: 3,
  medium: 2,
  easy: 1,
};

const getTodoPriorityScore = (todo: Todo): number => {
  if (todo.completed) return -100;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueScore = 0;
  if (todo.scheduledDate) {
    const due = new Date(todo.scheduledDate);
    if (!isNaN(due.getTime())) {
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) dueScore = 4;
      else if (diffDays === 1) dueScore = 3;
      else if (diffDays <= 3) dueScore = 2;
      else dueScore = 1;
    }
  }

  const difficultyScore = difficultyPriorityScore[todo.difficulty] ?? difficultyPriorityScore.medium;
  return dueScore * 10 + difficultyScore;
};

const sortTodosByPriority = (items: Todo[]): Todo[] => {
  const withIndex = items.map((todo, index) => ({ todo, index }));

  withIndex.sort((a, b) => {
    const aOverdue = !!a.todo.isOverdue && !a.todo.completed;
    const bOverdue = !!b.todo.isOverdue && !b.todo.completed;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const scoreDiff = getTodoPriorityScore(b.todo) - getTodoPriorityScore(a.todo);
    if (scoreDiff !== 0) return scoreDiff;

    return a.index - b.index;
  });

  return withIndex.map(({ todo }) => todo);
};

const isOverdueByDate = (dateStr: string | undefined, completed: boolean): boolean => {
  if (!dateStr || completed) return false;
  const scheduled = new Date(dateStr);
  if (isNaN(scheduled.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);

  return scheduled.getTime() < today.getTime();
};

const normalizeTodoFromApi = (todo: any): Todo => {
  const scheduledDate = todo.scheduledDate || todo.dueDate;
  const completed = Boolean(todo.completed);

  return {
    id: todo._id?.toString() || todo.id,
    title: todo.title || '',
    subject: todo.subject || 'General',
    difficulty: todo.difficulty || 'medium',
    questionsTarget: typeof todo.questionsTarget === 'number' ? todo.questionsTarget : 10,
    completed,
    scheduledDate,
    createdAt: todo.createdAt,
    originalScheduledDate: todo.originalScheduledDate,
    rescheduledCount: typeof todo.rescheduledCount === 'number' ? todo.rescheduledCount : 0,
    isOverdue: isOverdueByDate(scheduledDate, completed),
  };
};

// ─── Sortable TodoItem ───────────────────────────────────────────────────────
const SortableTodoItem = memo(
  ({
    todo,
    onToggle,
    onDelete,
    onRescheduleToday,
    onReschedule,
    onEdit,
    isDragDisabled,
  }: {
    todo: Todo;
    onToggle: (id: string, completed: boolean) => void;
    onDelete: (id: string) => void;
    onRescheduleToday: (id: string) => void;
    onReschedule: (id: string) => void;
    onEdit: (id: string, updates: Partial<Todo>) => void;
    isDragDisabled?: boolean;
  }) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
      id: todo.id,
      disabled: isDragDisabled,
      transition: {
        duration: 180,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : undefined,
      position: isDragging ? 'relative' : undefined,
      willChange: isDragging ? 'transform' : undefined,
    };

    const isOverdue = todo.isOverdue && !todo.completed;
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(todo.title);
    const [editSubject, setEditSubject] = useState(todo.subject);
    const [editDifficulty, setEditDifficulty] = useState<string>(todo.difficulty || 'medium');
    const [editCompleted, setEditCompleted] = useState(todo.completed);

    const handleStartEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditTitle(todo.title);
      setEditSubject(todo.subject);
      setEditDifficulty(todo.difficulty || 'medium');
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

    const handleCancel = () => setIsEditing(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
      else if (e.key === 'Escape') { handleCancel(); }
    };

    const diffCfg = difficultyConfig[todo.difficulty] ?? difficultyConfig['medium'];

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-lg border-b last:border-0 border-border/50 group transition-colors duration-150 bg-transparent overflow-hidden transform-gpu
          ${isEditing ? 'bg-secondary/30 ring-1 ring-primary/20' : 'hover:bg-secondary/20'}
          ${isOverdue && !isEditing ? 'opacity-90 bg-destructive/5 dark:bg-destructive/10 border-destructive/20' : ''}
          ${todo.completed && !isEditing ? 'opacity-40' : ''}
          ${isDragging ? 'opacity-20 bg-secondary/20' : ''}
        `}
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
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-3">
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
                  <Select
                    value={editDifficulty}
                    onValueChange={(val) => setEditDifficulty(val)}
                  >
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">🟢 Easy</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="hard">🔴 Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <button
                  type="button"
                  onClick={() => setEditCompleted(!editCompleted)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 border ${editCompleted
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700'
                      : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    {editCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {editCompleted ? 'Done' : 'Pending'}
                  </span>
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 px-3 text-xs">
                  <XIcon className="h-3.5 w-3.5 mr-1" />Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!editTitle.trim()} className="h-8 px-3 text-xs">
                  <Check className="h-3.5 w-3.5 mr-1" />Save
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
              className="flex items-start gap-2 p-3"
            >
              {/* Drag handle */}
              {!isDragDisabled && (
                <button
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  className="mt-1 p-0.5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity touch-none flex-shrink-0"
                  tabIndex={-1}
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <div className="mt-1 flex-shrink-0">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => onToggle(todo.id, todo.completed)}
                  className="border-border/50 data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {todo.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-muted-foreground">{todo.subject}</p>
                  {/* Time badge for AI-scheduled tasks */}
                  {todo.source === 'schedule' && todo.startTime && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 bg-primary/10 text-primary">
                      <Calendar className="h-2.5 w-2.5" />
                      {todo.startTime}{todo.endTime ? `–${todo.endTime}` : ''}
                    </span>
                  )}
                  {/* Difficulty badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${diffCfg.color}`}>
                    {diffCfg.label}
                  </span>
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
                        <RotateCcw className="h-3 w-3" />{count}x
                      </span>
                    );
                  })()}
                </div>

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
                      <span className="text-xs text-rose-600 dark:text-rose-400">This task is overdue</span>
                      <div className="flex gap-1 ml-auto">
                        <Button variant="ghost" size="sm" onClick={() => onRescheduleToday(todo.id)} className="h-6 px-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/20">Do today</Button>
                        <Button variant="ghost" size="sm" onClick={() => onReschedule(todo.id)} className="h-6 px-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/20">Reschedule</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-primary/10 rounded-lg"
                  title="Edit task"
                >
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded-lg"
                  title="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
SortableTodoItem.displayName = 'SortableTodoItem';

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const todosQuery = useTodos();
  const { data: dailyEfficiencyData, isLoading: efficiencyLoading, isError: efficiencyError } = useDailyEfficiency(1);
  const dailyEfficiency = useMemo(() => dailyEfficiencyData as DailyEfficiency | null, [dailyEfficiencyData]);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoDifficulty, setNewTodoDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; todoId: string | null }>({
    open: false,
    todoId: null,
  });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const { toast } = useToast();

  // DnD state - separate from query data for smooth reordering
  const [dndTodos, setDndTodos] = useState<Todo[]>([]);
  
  // Use query data directly for rendering (React Query handles loading states)
  const todos = useMemo(() => {
    const data = todosQuery.data || [];
    return sortTodosByPriority(data.map((todo: any) => normalizeTodoFromApi(todo)));
  }, [todosQuery.data]);
  const isLoading = todosQuery.isLoading;
  const queryTodos = todos; // For editTodo revert

  // Mutation hooks
  const createTodoMutation = useCreateTodo();
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();
  const deleteTodosByDayMutation = useDeleteTodosByDay();
  const rescheduleTodoMutation = useRescheduleTodo();
  const rescheduleAllOverdueMutation = useRescheduleAllOverdue();
  const toggleTodoMutation = useToggleTodo();
  const rescheduleTodoToTodayMutation = useRescheduleTodoToToday();

  // DnD sensors — lower activation distance makes drag pickup feel quicker
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveDragId(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const regularTodos = todos.filter((t) => !t.isOverdue || t.completed);
    const overdueTodos = todos.filter((t) => t.isOverdue && !t.completed);
    const oldIndex = regularTodos.findIndex((t) => t.id === active.id);
    const newIndex = regularTodos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(regularTodos, oldIndex, newIndex);
    const updatedTodos = [...overdueTodos, ...reordered];
    // Store for DnD operations only
    setDndTodos(updatedTodos);
  }, [todos]);

  // Handler functions using mutation hooks instead of manual fetch
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
      difficulty: newTodoDifficulty,
      questionsTarget: 10,
      completed: false,
      scheduledDate: today.toISOString(),
      isOverdue: false,
      rescheduledCount: 0,
    };

    // Optimistic update - add to DnD state immediately
    setDndTodos((prev) => sortTodosByPriority([...prev, optimisticTodo]));
    setNewTodo('');
    soundManager.playAdd();

    try {
      await createTodoMutation.mutateAsync({
        title: newTodo.trim(),
        subject: 'General',
        difficulty: newTodoDifficulty,
        questionsTarget: 10,
        dueDate: today.toISOString(),
      });

      toast({
        title: 'Task added for today!',
        description: 'Complete it to earn 2 points',
      });
    } catch (error) {
      console.error('Error adding todo:', error);
      // Revert optimistic update on error
      setDndTodos((prev) => prev.filter((todo) => todo.id !== optimisticTodo.id));
      setNewTodo(newTodo.trim());
      toast({
        title: 'Failed to add task',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  }, [newTodo, newTodoDifficulty, toast, createTodoMutation]);

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      // Optimistic update — instantly flip in DnD state
      setDndTodos(prev => prev.map(t =>
        t.id === id ? { ...t, completed: !completed, isOverdue: !completed ? false : t.isOverdue } : t
      ));

      if (!completed) {
        soundManager.playSuccess();
      }

      try {
        await toggleTodoMutation.mutateAsync({ id, completed: !completed });
        
        if (!completed) {
          // Note: Points info is available in the response but React Query invalidates automatically
          toast({ title: 'Task completed!', description: 'Well done!' });
        }
      } catch (error) {
        console.error('Error toggling todo:', error);
        // Revert on error
        setDndTodos(prev => prev.map(t =>
          t.id === id ? { ...t, completed, isOverdue: t.isOverdue } : t
        ));
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [toggleTodoMutation, toast]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      // Optimistic update — remove from DnD state immediately
      const previousTodos = dndTodos;
      setDndTodos(prev => prev.filter(t => t.id !== id));
      soundManager.playDelete();

      try {
        await deleteTodoMutation.mutateAsync(id);
        toast({ title: 'Task deleted' });
      } catch (error) {
        console.error('Error deleting todo:', error);
        // Revert on error
        setDndTodos(previousTodos);
        toast({ title: 'Failed to delete task', variant: 'destructive' });
      }
    },
    [dndTodos, toast, deleteTodoMutation]
  );

  const rescheduleToToday = useCallback(
    async (id: string) => {
      try {
        const result = await rescheduleTodoToTodayMutation.mutateAsync({ id });
        
        const pointsMsg = result.pointsCredited ? ` (+${result.pointsCredited} points)` : '';
        toast({ title: 'Task rescheduled to today', description: `Complete it to earn points!${pointsMsg}` });
      } catch (error) {
        console.error('Error rescheduling todo:', error);
        toast({ title: 'Error rescheduling task', variant: 'destructive' });
      }
    },
    [rescheduleTodoToTodayMutation, toast]
  );

  const rescheduleAllOverdue = useCallback(
    async () => {
      // Optimistic: move all overdue tasks to today in DnD state
      const todayISO = new Date().toISOString();
      setDndTodos(prev => prev.map(t =>
        t.isOverdue && !t.completed
          ? { ...t, scheduledDate: todayISO, isOverdue: false, rescheduledCount: (t.rescheduledCount || 0) + 1 }
          : t
      ));

      try {
        const result = await rescheduleAllOverdueMutation.mutateAsync({});
        toast({
          title: 'All overdue tasks rescheduled!',
          description: `${result.count} task${result.count > 1 ? 's' : ''} moved to today`
        });
      } catch (error) {
        console.error('Error rescheduling all overdue:', error);
        toast({ title: 'Failed to reschedule tasks', variant: 'destructive' });
      }
    },
    [rescheduleAllOverdueMutation, toast]
  );

  const deleteAllForToday = useCallback(
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Destructive bulk action — require explicit confirmation.
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm("Delete all of today's tasks? This cannot be undone.");
      if (!confirmed) return;

      // Optimistic: remove all of today's (non-overdue) tasks from DnD state.
      const previousTodos = dndTodos;
      setDndTodos(prev => prev.filter(t => t.isOverdue && !t.completed));
      soundManager.playDelete();

      try {
        const result = await deleteTodosByDayMutation.mutateAsync({ date: today });
        toast({
          title: 'Tasks cleared',
          description: `${result.count} task${result.count === 1 ? '' : 's'} deleted for today`,
        });
      } catch (error) {
        console.error('Error deleting all tasks for today:', error);
        setDndTodos(previousTodos);
        toast({ title: 'Failed to delete tasks', variant: 'destructive' });
      }
    },
    [dndTodos, deleteTodosByDayMutation, toast]
  );
  const editTodo = useCallback(
    async (id: string, updates: Partial<Todo>) => {
      // Optimistic update in DnD state
      setDndTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      soundManager.playClick();

      try {
        await updateTodoMutation.mutateAsync({ id, data: updates });
        toast({ title: 'Task updated' });
      } catch (error) {
        console.error('Error editing todo:', error);
        // Revert on error - need to get the original todo from query data
        setDndTodos((prev) => {
          const queryTodo = queryTodos.find(t => t.id === id);
          if (queryTodo) {
            return prev.map(t => (t.id === id ? queryTodo : t));
          }
          return prev;
        });
        toast({ title: 'Failed to update task', variant: 'destructive' });
      }
    },
    [queryTodos, updateTodoMutation, toast]
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

    try {
      const result = await rescheduleTodoMutation.mutateAsync({
        id: rescheduleModal.todoId,
        newDate: new Date(rescheduleDate)
      });
      
      setRescheduleModal({ open: false, todoId: null });
      const pointsMsg = result.pointsCredited ? ` (+${result.pointsCredited} points)` : '';
      toast({ title: 'Task rescheduled', description: `Scheduled for ${new Date(rescheduleDate).toLocaleDateString()}${pointsMsg}` });
    } catch (error) {
      console.error('Error rescheduling todo:', error);
      toast({ title: 'Failed to reschedule', variant: 'destructive' });
    }
  }, [rescheduleModal.todoId, rescheduleDate, rescheduleTodoMutation, toast]);

  const completedCount = useMemo(() => todos.filter((t) => t.completed).length, [todos]);
  const overdueCount = useMemo(() => todos.filter((t) => t.isOverdue && !t.completed).length, [todos]);
  const overdueTodos = useMemo(() => todos.filter((t) => t.isOverdue && !t.completed), [todos]);
  const regularTodos = useMemo(() => todos.filter((t) => !t.isOverdue || t.completed), [todos]);
  const activeDragTodo = useMemo(
    () => regularTodos.find((todo) => todo.id === activeDragId) || null,
    [regularTodos, activeDragId]
  );
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

  // Motion: orchestrated entrance for the dashboard. Respects reduced-motion.
  const reduce = useReducedMotion();
  const item = getRiseItem(reduce);
  const hoverLift = reduce ? undefined : { y: -6, transition: springSnappy };

  return (
    <>
      <AmbientBackground />
      <motion.div
      className="space-y-6"
      variants={staggerContainer(0.08, 0.05)}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Hi, {displayName}! 👋</h1>
          <p className="text-sm text-muted-foreground">
            {daysUntilExam} days until {user?.examGoal}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <GlassButton
            onClick={() => setShowAnalytics(!showAnalytics)}
            size="sm"
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </GlassButton>
          <GlassButton
            onClick={() => navigate('/friends')}
            size="sm"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Find Friends</span>
          </GlassButton>
        </div>
      </motion.div>

      {/* Stats Cards - Responsive Grid on Large Screens, Horizontal Scroll on Mobile.
          Single shared glass shell (perf budget) — see MotionCard comment above. */}
      <motion.div
        variants={staggerContainer(0.07)}
        className="sbd-glass sbd-glass--card p-3 xs:p-4 grid grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap gap-3 xs:gap-4 xl:gap-6 xl:overflow-x-auto xl:pb-1 xl:scrollbar-thin xl:scrollbar-thumb-muted xl:scrollbar-track-transparent"
      >
        {/* Today's Tasks Card */}
        <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[180px] xl:flex-shrink-0">
          <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
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
                  <AnimatedNumber
                    value={todaysTasks}
                    className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-primary transition-colors"
                  />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Active tasks
                </p>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Overdue Tasks Card */}
        {overdueCount > 0 && (
          <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[180px] xl:flex-shrink-0 line-through-animation">
            <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
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
                    <AnimatedNumber
                      value={overdueCount}
                      className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-destructive"
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                    Need attention
                  </p>
                </div>
              </div>
            </CardContent>
          </MotionCard>
        )}

        {/* Completed Tasks Card */}
        <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[180px] xl:flex-shrink-0">
          <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
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
                  <AnimatedNumber
                    value={completedCount}
                    className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-success transition-colors"
                  />
                  <span className="text-sm font-bold font-mono text-muted-foreground">/{todos.length}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Completed today
                </p>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Overall Efficiency Card */}
        <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[220px] xl:flex-shrink-0">
          <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 border border-border/50 bg-background/50 rounded-lg group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors duration-300">
                  <Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Efficiency
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  {efficiencyLoading ? (
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground">
                      --
                    </span>
                  ) : (
                    <AnimatedNumber
                      value={Math.round(dailyEfficiency?.overallEfficiencyPct || 0)}
                      suffix="%"
                      className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-primary transition-colors"
                    />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  {efficiencyLoading
                    ? 'Calculating daily score...'
                    : `${dailyEfficiency?.completedTasks || 0}/${dailyEfficiency?.scheduledTasks || 0} tasks • ${dailyEfficiency?.timerUsedMinutes || 0}/${Math.round(dailyEfficiency?.timerTimeTakenMinutes || 0)} min`}
                </p>
                {!efficiencyLoading && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {dailyEfficiency?.abandonedTimerStarts || 0} abandoned starts • -{(dailyEfficiency?.strictPenaltyPoints || 0).toFixed(1)} penalty
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Total Points Card */}
        <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[180px] xl:flex-shrink-0">
          <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
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
                  <AnimatedNumber
                    value={user?.totalPoints || 0}
                    className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-accent transition-colors"
                  />
                  <span className="text-sm font-bold font-mono text-muted-foreground">XP</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Total earned
                </p>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Streak Card */}
        <MotionCard variants={item} whileHover={hoverLift} className="group relative min-w-0 overflow-hidden rounded-xl bg-background/40 sm:min-w-[180px] xl:flex-shrink-0">
          <CardContent className="relative flex h-full flex-col justify-between p-4 sm:p-6">
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
                  <AnimatedNumber
                    value={user?.streak || 0}
                    className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-foreground group-hover:text-accent transition-colors"
                  />
                  <span className="text-sm font-bold font-mono text-muted-foreground">Days</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Active streak
                </p>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Anchored Study Timer Component (Floating out-of-flow beside stats) */}
        <div className="absolute inset-0 z-[100] pointer-events-none">
          <StudyTimer />
        </div>
      </motion.div>

      {/* Admin Panel - Only visible to admin users */}
      {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
        <SolidCard className="border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <SolidCardHeader>
            <SolidCardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Access
            </SolidCardTitle>
          </SolidCardHeader>
          <SolidCardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
              You have administrator privileges. Access the admin dashboard to manage users and send daily stats emails.
            </p>
            <Button
              onClick={() => navigate('/admin')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Open Admin Dashboard
            </Button>
          </SolidCardContent>
        </SolidCard>
      )}

      {showAnalytics ? (
        <motion.div variants={item}>
          <AnalyticsDashboard user={user || undefined} />
        </motion.div>
      ) : (
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-transparent shadow-xl">
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
                {regularTodos.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteAllForToday}
                    title="Delete all of today's tasks"
                    className="ml-auto h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear Day
                  </Button>
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
              <div className="w-40">
                <Select value={newTodoDifficulty} onValueChange={(value) => setNewTodoDifficulty(value as 'easy' | 'medium' | 'hard')}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {isLoading ? (
                  <SkeletonList count={3} />
                ) : (
                  <>
                    {/* Overdue tasks (not draggable) */}
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
                              Redo Today All
                            </Button>
                          </div>
                          <AnimatePresence mode="popLayout">
                            {overdueTodos.map((todo) => (
                                <SortableTodoItem
                                  key={todo.id}
                                  todo={todo}
                                  onToggle={toggleTodo}
                                  onDelete={deleteTodo}
                                  onRescheduleToday={rescheduleToToday}
                                  onReschedule={openRescheduleModal}
                                  onEdit={editTodo}
                                  isDragDisabled
                                />
                              ))}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Regular tasks — drag-to-reorder */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragCancel={handleDragCancel}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={regularTodos.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <AnimatePresence mode="popLayout">
                          {regularTodos.map((todo) => (
                            <SortableTodoItem
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
                      </SortableContext>
                      {typeof document !== 'undefined' && createPortal(
                        <DragOverlay
                          adjustScale={false}
                          dropAnimation={{
                            duration: 200,
                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        >
                          {activeDragTodo ? (
                            <div className="sbd-glass sbd-glass--elevated overflow-hidden">
                              <div className="flex items-start gap-2 p-3">
                                <div className="mt-1 p-0.5 rounded opacity-60">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="mt-1 flex-shrink-0">
                                  <Checkbox
                                    checked={activeDragTodo.completed}
                                    className="border-border/50 data-[state=checked]:bg-primary"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${activeDragTodo.completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {activeDragTodo.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <p className="text-xs text-muted-foreground">{activeDragTodo.subject}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${(difficultyConfig[activeDragTodo.difficulty] ?? difficultyConfig.medium).color}`}>
                                      {(difficultyConfig[activeDragTodo.difficulty] ?? difficultyConfig.medium).label}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${activeDragTodo.isOverdue && !activeDragTodo.completed
                                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                                      : 'bg-muted text-muted-foreground'
                                      }`}>
                                      <Calendar className="h-3 w-3" />
                                      {formatScheduledDate(activeDragTodo.scheduledDate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </DragOverlay>,
                        document.body
                      )}
                    </DndContext>
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
        </motion.div>
      )}

      {/* Reschedule Modal */}
      <GlassModal
        open={rescheduleModal.open}
        onOpenChange={(open) => setRescheduleModal({ open, todoId: open ? rescheduleModal.todoId : null })}
        ariaLabel="Reschedule Objective"
      >
        <CardHeader className="border-b border-white/10 pb-4">
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
            <GlassButton
              variant="ghost"
              onClick={() => setRescheduleModal({ open: false, todoId: null })}
              className="text-xs font-semibold"
            >
              Cancel
            </GlassButton>
            <GlassButton variant="primary" onClick={handleReschedule} className="text-xs font-semibold">
              Confirm Reschedule
            </GlassButton>
          </div>
        </CardContent>
      </GlassModal>
    </motion.div>
    </>
  );
}
