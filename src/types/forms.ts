// Form types matching Prisma schema

export type FormAccessType = 'PUBLIC' | 'AUTHENTICATED' | 'DOMAIN_LIMITED';

export type FieldType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'DROPDOWN'
  | 'LINEAR_SCALE'
  | 'DATE'
  | 'TIME'
  | 'NUMBER'
  | 'RATING'
  | 'FILE_UPLOAD';

export interface Form {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  heroBadge: string | null;
  customSlug: string | null;
  isAcceptingResponses: boolean;
  isDeleted: boolean;
  archivedAt: Date | null;
  accessType: FormAccessType;
  allowedDomain: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  confirmationMessage: string | null;
  allowMultipleSubmissions: boolean;
  createdAt: Date;
  updatedAt: Date;
  sections?: FormSection[];
  fields?: FormField[];
  _count?: {
    responses: number;
  };
}

export interface FormSection {
  id: string;
  formId: string;
  title: string;
  description: string | null;
  order: number;
  fields?: FormField[];
  _count?: {
    fields: number;
  };
}

export interface FormField {
  id: string;
  formId: string;
  sectionId: string | null;
  label: string;
  description: string | null;
  helpText: string | null;
  fieldType: FieldType;
  isRequired: boolean;
  order: number;
  config: FieldConfig | null;
  logic: unknown | null;
  section?: {
    id: string;
    title: string;
    order: number;
  };
}

export interface FieldConfig {
  // Text fields
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  regex?: string;

  // Choice fields
  options?: string[];
  allowOther?: boolean;

  // Number fields
  min?: number;
  max?: number;
  step?: number;
  unit?: string;

  // Scale fields
  minLabel?: string;
  maxLabel?: string;

  // Date/Time fields
  minDate?: string;
  maxDate?: string;
  format?: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  responderUserId: string | null;
  responderEmail: string | null;
  responderName: string | null;
  submittedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isStarred: boolean;
  isFlagged: boolean;
  answers?: FormAnswer[];
  responder?: {
    name: string;
    email: string;
    avatar: string | null;
  };
}

export interface FormAnswer {
  id: string;
  responseId: string;
  fieldId: string;
  value: string;
  field?: {
    label: string;
    fieldType: FieldType;
  };
}

export interface FieldAnalytics {
  fieldId: string;
  label: string;
  fieldType: FieldType;
  totalAnswers: number;
  filledAnswers: number;
  fillRate: number;
  distribution?: Array<{
    value: string | number;
    count: number;
    percentage: number;
  }>;
  average?: number;
  median?: number;
  min?: number;
  max?: number;
  sum?: number;
  avgLength?: number;
  minLength?: number;
  maxLength?: number;
}

export interface FormAnalyticsSummary {
  totalResponses: number;
  starred: number;
  flagged: number;
  responsesOverTime: Array<{
    date: Date;
    count: number;
  }>;
  createdAt: Date;
  lastResponseAt: Date | null;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  SHORT_TEXT: 'Short Answer',
  LONG_TEXT: 'Paragraph',
  MULTIPLE_CHOICE: 'Multiple Choice',
  CHECKBOXES: 'Checkboxes',
  DROPDOWN: 'Dropdown',
  LINEAR_SCALE: 'Linear Scale',
  DATE: 'Date',
  TIME: 'Time',
  NUMBER: 'Number',
  RATING: 'Rating',
  FILE_UPLOAD: 'File Upload',
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  SHORT_TEXT: '📝',
  LONG_TEXT: '📄',
  MULTIPLE_CHOICE: '🔘',
  CHECKBOXES: '☑️',
  DROPDOWN: '📋',
  LINEAR_SCALE: '📊',
  DATE: '📅',
  TIME: '⏰',
  NUMBER: '🔢',
  RATING: '⭐',
  FILE_UPLOAD: '📎',
};
