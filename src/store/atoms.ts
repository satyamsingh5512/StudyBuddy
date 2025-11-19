import { atom } from 'jotai';

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
  streak: number;
}

export const userAtom = atom<User | null | undefined>(undefined);
export const studyingAtom = atom(false);
export const studyTimeAtom = atom(0);
