export interface JournalEntry {
  id?: string;
  date: string;
  markdown: string;
  revision: number;
  attachmentIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalAttachment {
  id: string;
  mime: 'image/jpeg' | 'image/png' | 'image/gif';
  size: number;
  url: string;
}

export interface JournalDraft {
  date: string;
  markdown: string;
  baseRevision: number;
  savedAt: string;
}

export type JournalSaveState = 'Saving' | 'Saved' | 'Offline' | 'Conflict' | 'Error';

export type MentorRole = 'user' | 'assistant';

export interface MentorMessage {
  id: string;
  role: MentorRole;
  content: string;
}

export interface MentorHistoryMessage {
  role: MentorRole;
  content: string;
}

export interface MentorRequest {
  message: string;
  history: MentorHistoryMessage[];
  maxOutputTokens: number;
  /** Request-local consent; does not mutate the saved profile preference. */
  includeJournal: boolean;
}

export interface MentorContextMetadata {
  contextBytes: number;
  journalIncluded: boolean;
  counts: {
    goals: number;
    showUps: number;
    journal: number;
    tasks: number;
    sessions: number;
    reports: number;
  };
}

export interface MentorResponse {
  response: string;
  metadata: MentorContextMetadata;
}

export type AchievementCategory = 'streak' | 'goals';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  title: string;
  target: number;
  progress: number;
  earned: boolean;
}

export interface AchievementsResponse {
  bestStreak: number;
  completedGoals: number;
  achievements: Achievement[];
}

export const ACCENT_IDS = [
  'blue',
  'violet',
  'teal',
  'green',
  'orange',
  'rose',
  'purple',
  'indigo',
  'cyan',
  'lime',
  'yellow',
  'amber',
  'red',
  'pink',
] as const;

export type AccentPreference = (typeof ACCENT_IDS)[number];

export interface UserPreferences {
  font?: 'sans' | 'mono' | 'serif';
  accent?: AccentPreference;
  dashboard?: { order: string[]; hidden: string[] };
  showUpReminder?: { enabled: boolean; time: string; days: number[] };
  mentorJournalContext?: boolean;
}
