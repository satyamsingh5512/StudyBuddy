export type DateKey = string;
export type GoalStatus = 'active' | 'completed' | 'archived';
export type GoalGridMode = 'daily' | 'weekly';
export type GoalCompletionPolicy = 'auto' | 'manual';
export type GoalActivityStatus = 'complete' | 'partial';
export type GoalActivitySource = 'manual' | 'automatic';

export interface SubGoal {
  id: string;
  title: string;
  position: number;
  completed: boolean;
  completedAt?: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  position: number;
  targetDate?: DateKey | null;
  completed: boolean;
  completedAt?: string | null;
}

export interface Goal {
  id: string;
  definitionVersion: number;
  title: string;
  description?: string;
  status: GoalStatus;
  gridMode: GoalGridMode;
  completionPolicy: GoalCompletionPolicy;
  startDate: DateKey;
  targetDate?: DateKey | null;
  subGoals: SubGoal[];
  milestones: Milestone[];
  completedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalCompletion {
  id: string;
  goalId: string;
  subGoalId: string;
  definitionVersion: number;
  date: DateKey;
  status: GoalActivityStatus;
  source: GoalActivitySource;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShowUp {
  id: string;
  goalId: string;
  definitionVersion?: number;
  date: DateKey;
  status: GoalActivityStatus;
  source: GoalActivitySource;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalCheckIn {
  id: string;
  goalId: string;
  weekStart: DateKey;
  targetMomentum: number;
  reflection?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalWeekdayPattern {
  weekday: string;
  completed: number;
  partial: number;
  eligible: number;
  completionRate: number;
}

export interface GoalShowUpSummary {
  complete: number;
  partial: number;
  total: number;
}

export interface GoalStats {
  from: DateKey;
  to: DateKey;
  momentum: number;
  currentStreak: number;
  bestStreak: number;
  weekdayPattern: GoalWeekdayPattern[];
  showUps: GoalShowUpSummary;
  targetMomentum?: number;
  momentumDelta?: number;
}

export interface GoalSubGoalInput { title: string; completed?: boolean }
export interface GoalMilestoneInput { title: string; targetDate?: DateKey | null; completed?: boolean }

export interface CreateGoalInput {
  title: string;
  description: string;
  gridMode: GoalGridMode;
  completionPolicy: GoalCompletionPolicy;
  startDate: DateKey;
  targetDate: DateKey | null;
  subGoals: GoalSubGoalInput[];
  milestones: GoalMilestoneInput[];
}

export type PatchGoalInput = Partial<CreateGoalInput>;
export interface AddSubGoalInput { title: string }
export interface UpdateSubGoalInput { title?: string; completed?: boolean }
export interface AddMilestoneInput { title: string; targetDate?: DateKey | null; completed?: boolean }
export interface UpdateMilestoneInput { title?: string; targetDate?: DateKey | null; completed?: boolean }
export interface ReorderInput { orderedIds: string[] }
export interface PutGoalActivityInput { status: GoalActivityStatus; source?: 'manual'; note?: string }
export interface PutGoalCheckInInput { targetMomentum: number; reflection: string }
export interface GoalListOptions { status?: GoalStatus; limit?: number; offset?: number }
export interface GoalRange { from: DateKey; to: DateKey }
export type GoalLifecycleAction = 'complete' | 'archive' | 'restore';
