import { addCalendarDays, dateKey } from '@/lib/goalDates';
import type { CreateGoalInput } from '@/types/goals';

export type GoalTemplateId = 'jee' | 'neet' | 'upsc' | 'gate' | 'cat' | 'custom';
export interface GoalTemplate {
  id: GoalTemplateId;
  name: string;
  description: string;
  weeks: number | null;
  gridMode: CreateGoalInput['gridMode'];
  completionPolicy: CreateGoalInput['completionPolicy'];
  subGoals: string[];
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { id: 'jee', name: 'JEE Daily Revision', description: 'Build recall through concepts, formulas, and a daily error-log review.', weeks: 12, gridMode: 'daily', completionPolicy: 'auto', subGoals: ['Revise core concepts', 'Recall key formulas', 'Review the error log'] },
  { id: 'neet', name: 'NEET Question Practice', description: 'Keep Physics, Chemistry, and Biology question practice moving every day.', weeks: 12, gridMode: 'daily', completionPolicy: 'auto', subGoals: ['Physics questions', 'Chemistry questions', 'Biology questions'] },
  { id: 'upsc', name: 'UPSC Consistency', description: 'A sustainable open-ended rhythm for current affairs, syllabus, and writing.', weeks: null, gridMode: 'daily', completionPolicy: 'auto', subGoals: ['Current affairs', 'Core syllabus study', 'Answer writing'] },
  { id: 'gate', name: 'GATE Problem Solving', description: 'Combine concept review, timed problems, and mistake correction.', weeks: 12, gridMode: 'daily', completionPolicy: 'auto', subGoals: ['Review one concept', 'Solve timed problems', 'Review mistakes'] },
  { id: 'cat', name: 'CAT Sprint', description: 'Run a focused weekly sprint across Quant, VARC, and DILR.', weeks: 8, gridMode: 'weekly', completionPolicy: 'manual', subGoals: ['Quant practice', 'VARC practice', 'DILR practice'] },
  { id: 'custom', name: 'Custom goal', description: 'Start with a blank plan and shape it around your exam.', weeks: null, gridMode: 'daily', completionPolicy: 'manual', subGoals: [] },
];

export const templateToGoal = (template: GoalTemplate, today = dateKey(new Date())): CreateGoalInput => ({
  title: template.id === 'custom' ? '' : template.name,
  description: template.id === 'custom' ? '' : template.description,
  gridMode: template.gridMode,
  completionPolicy: template.completionPolicy,
  startDate: today,
  targetDate: template.weeks ? addCalendarDays(today, template.weeks * 7 - 1) : null,
  subGoals: template.subGoals.map((title) => ({ title })),
  milestones: [],
});
