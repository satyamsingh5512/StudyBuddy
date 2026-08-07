export type TodoDifficulty = 'easy' | 'medium' | 'hard';

export interface Todo {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  difficulty: TodoDifficulty;
  questionsTarget: number;
  completed: boolean;
  scheduledDate?: string;
  dueDate?: string;
  originalScheduledDate?: string;
  rescheduledCount?: number;
  source?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Client-only marker used while a create request is in flight. */
  optimistic?: boolean;
}

export type CreateTodoInput = Pick<Todo, 'title'> &
  Partial<
    Pick<
      Todo,
      'subject' | 'difficulty' | 'questionsTarget' | 'dueDate' | 'scheduledDate'
    >
  >;

export interface UpdateTodoInput {
  title?: string;
  subject?: string;
  difficulty?: string;
  questionsTarget?: number;
  completed?: boolean;
  dueDate?: string;
  scheduledDate?: string;
}
