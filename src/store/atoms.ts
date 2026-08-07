import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  avatarType?: string;
  onboardingDone?: boolean;
  examGoal: string;
  examDate: string;
  statsResetAt?: string;
  lastStudyAt?: string;
  timezone?: string;
  bestStreak?: number;
  showProfile?: boolean;
  emailVerified?: boolean;
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
  subjects?: string[];
  preferences?: import('@/types/content').UserPreferences;
}

export const userAtom = atom<User | null>(null);
export const authLoadingAtom = atom(true);
export const studyingAtom = atom(false);
export const studyTimeAtom = atom(0);
export const timerSessionStartAtom = atom<string | null>(null);

// Toggle for heavy animations vs performance
export const performanceModeAtom = atomWithStorage('studybuddy_performance_mode', false);
