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
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
  subjects?: string[];
}

export const userAtom = atom<User | null>(null);
export const studyingAtom = atom(false);
export const studyTimeAtom = atom(0);
export const timerSessionStartAtom = atom<string | null>(null);

// Toggle for heavy animations vs performance
export const performanceModeAtom = atomWithStorage('studybuddy_performance_mode', false);
