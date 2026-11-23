export type AppTab = 'simulator' | 'analytics' | 'certificates' | 'leaderboard' | 'community';

export type LevelId = 1 | 2 | 3 | 4;

export type CellFormat = 'general' | 'currency' | 'percent' | 'number' | 'header' | 'date';

export interface CellData {
  raw: string;
  format?: CellFormat;
  readOnly?: boolean;
}

export type SheetGrid = Record<string, CellData>;

export interface EvaluationStep {
  id: string;
  expression: string;
  description: string;
  result: string;
  referencedCells: string[];
}

export interface CellEvaluation {
  value: string | number | boolean | null;
  displayValue: string;
  error?: string;
  referencedCells: string[];
  steps: EvaluationStep[];
}

export type FormulaCatalogCategory =
  | 'Dasar'
  | 'Logika'
  | 'Teks & Tanggal'
  | 'Pencarian'
  | 'Statistical'
  | 'Financial';

export interface FormulaCatalogItem {
  name: string;
  category: FormulaCatalogCategory;
  syntax: string;
  summary: string;
  example: string;
}

export interface CaseStudyStep {
  title: string;
  targetCell: string;
  formula: string;
  explanation: string;
}

export interface LessonModule {
  id: string;
  level: LevelId;
  levelTitle: string;
  category: FormulaCatalogCategory;
  mode: 'case-study' | 'practice';
  title: string;
  subtitle: string;
  scenario: string;
  functionsCovered: string[];
  xpReward: number;
  estimatedMinutes: number;
  initialGrid: SheetGrid;
  targetCell: string;
  expectedFormulaHints: string[];
  requiredFunctions: string[];
  expectedValue: string | number | boolean;
  numericTolerance?: number;
  solutionFormula: string;
  hint: string;
  walkthroughSteps?: CaseStudyStep[];
}

export interface DailyActivityLog {
  date: string; // YYYY-MM-DD
  minutesSpent: number;
  exercisesCompleted: number;
  xpEarned: number;
  attempts: number;
  correctAttempts: number;
}

export interface CertificateRecord {
  id: string;
  level: LevelId;
  levelTitle: string;
  learnerName: string;
  issuedAt: string;
  accuracyPercent: number;
  completedModules: number;
}

export interface ForumReply {
  id: string;
  author: string;
  authorRank: string;
  createdAt: string;
  body: string;
  formulaSnippet?: string;
  upvotes: number;
  upvotedByMe?: boolean;
  pendingSync?: boolean;
}

export interface ForumThread {
  id: string;
  topic: 'Dasar' | 'Logika' | 'Teks & Tanggal' | 'Pencarian' | 'Tips Kasus';
  title: string;
  author: string;
  authorRank: string;
  createdAt: string;
  body: string;
  formulaSnippet?: string;
  presetModuleId?: string;
  upvotes: number;
  upvotedByMe?: boolean;
  replies: ForumReply[];
  pendingSync?: boolean;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  city: string;
  xp: number;
  streakDays: number;
  complexFormulasMastered: number;
  weeklyXp: number;
  rankTitle: string;
  isCurrentUser?: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:mm
  days: number[]; // 0 (Sun) - 6 (Sat)
  customMessage: string;
  lastTriggeredDate?: string;
}

export interface UserProgressState {
  learnerName: string;
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  completedModuleIds: string[];
  masteredFunctions: string[];
  totalAttempts: number;
  correctAttempts: number;
  totalSecondsPracticed: number;
  dailyLogs: Record<string, DailyActivityLog>;
  certificates: Record<number, CertificateRecord>;
  reminder: ReminderSettings;
  offlineSyncQueueCount: number;
}
