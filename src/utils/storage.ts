import {
  LeaderboardUser,
  UserProgressState,
} from '../types/app';

const PROGRESS_KEY = 'rumuslab_progress_v1';
const DB_NAME = 'rumuslab_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateOffsetISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${day ? m : m}-${day}`;
}

export interface GamificationRank {
  id: string;
  title: string;
  minXp: number;
  maxXp: number;
  description: string;
}

export const GAMIFICATION_RANKS: GamificationRank[] = [
  {
    id: 'rank-1',
    title: 'Pemula Tabel',
    minXp: 0,
    maxXp: 249,
    description: 'Menguasai navigasi sel dan operasi penjumlahan dasar.',
  },
  {
    id: 'rank-2',
    title: 'Analis Formula',
    minXp: 250,
    maxXp: 599,
    description: 'Terampil menggunakan fungsi agregasi dan logika IF sederhana.',
  },
  {
    id: 'rank-3',
    title: 'Arsitek Logika',
    minXp: 600,
    maxXp: 1099,
    description: 'Mampu mengolah kondisi bertingkat dan normalisasi teks otomatis.',
  },
  {
    id: 'rank-4',
    title: 'Master Spreadsheet',
    minXp: 1100,
    maxXp: 1799,
    description: 'Mahir pencarian lintas tabel dengan VLOOKUP, XLOOKUP, dan IFERROR.',
  },
  {
    id: 'rank-5',
    title: 'Grandmaster Excel',
    minXp: 1800,
    maxXp: 999999,
    description: 'Menguasai rumus analisis multi-kriteria dan pemecahan kasus kompleks.',
  },
];

export function getRankForXp(xp: number): GamificationRank {
  for (let i = GAMIFICATION_RANKS.length - 1; i >= 0; i--) {
    if (xp >= GAMIFICATION_RANKS[i].minXp) return GAMIFICATION_RANKS[i];
  }
  return GAMIFICATION_RANKS[0];
}

function buildInitialDailyLogs() {
  const logs: UserProgressState['dailyLogs'] = {};
  // Seed realistic last 10 days of light prior baseline activity + today empty ready for practice
  const samplePattern = [
    { offset: 12, min: 14, ex: 2, xp: 140, att: 3, cor: 2 },
    { offset: 10, min: 18, ex: 2, xp: 160, att: 2, cor: 2 },
    { offset: 8, min: 12, ex: 1, xp: 80, att: 2, cor: 1 },
    { offset: 6, min: 22, ex: 3, xp: 210, att: 4, cor: 3 },
    { offset: 4, min: 15, ex: 2, xp: 150, att: 2, cor: 2 },
    { offset: 2, min: 10, ex: 1, xp: 90, att: 2, cor: 1 },
    { offset: 1, min: 16, ex: 2, xp: 170, att: 3, cor: 2 },
  ];
  for (const s of samplePattern) {
    const date = getDateOffsetISO(s.offset);
    logs[date] = {
      date,
      minutesSpent: s.min,
      exercisesCompleted: s.ex,
      xpEarned: s.xp,
      attempts: s.att,
      correctAttempts: s.cor,
    };
  }
  return logs;
}

export const DEFAULT_PROGRESS: UserProgressState = {
  learnerName: 'Pembelajar RumusLab',
  xp: 280,
  streakDays: 3,
  lastActiveDate: getDateOffsetISO(1),
  completedModuleIds: ['lvl1-case-warung', 'lvl1-prac-rata-nilai'],
  masteredFunctions: ['SUM', 'AVERAGE'],
  totalAttempts: 6,
  correctAttempts: 5,
  totalSecondsPracticed: 1920,
  dailyLogs: buildInitialDailyLogs(),
  certificates: {},
  reminder: {
    enabled: false,
    time: '19:30',
    days: [1, 2, 3, 4, 5],
    customMessage: 'Waktunya 10 menit latihan rumus Excel harian di RumusLab.',
  },
};

export const INITIAL_LEADERBOARD_PEERS: Omit<LeaderboardUser, 'isCurrentUser'>[] = [
  {
    id: 'peer-1',
    name: 'Nadia Kusuma',
    city: 'Bandung',
    xp: 2140,
    streakDays: 19,
    complexFormulasMastered: 18,
    weeklyXp: 640,
    rankTitle: 'Grandmaster Excel',
  },
  {
    id: 'peer-2',
    name: 'Reza Mahendra',
    city: 'Surabaya',
    xp: 1680,
    streakDays: 14,
    complexFormulasMastered: 15,
    weeklyXp: 510,
    rankTitle: 'Master Spreadsheet',
  },
  {
    id: 'peer-3',
    name: 'Putri Handayani',
    city: 'Yogyakarta',
    xp: 1320,
    streakDays: 11,
    complexFormulasMastered: 13,
    weeklyXp: 430,
    rankTitle: 'Master Spreadsheet',
  },
  {
    id: 'peer-4',
    name: 'Fajar Nugroho',
    city: 'Jakarta',
    xp: 950,
    streakDays: 8,
    complexFormulasMastered: 10,
    weeklyXp: 360,
    rankTitle: 'Arsitek Logika',
  },
  {
    id: 'peer-5',
    name: 'Salsa Maharani',
    city: 'Semarang',
    xp: 690,
    streakDays: 6,
    complexFormulasMastered: 8,
    weeklyXp: 290,
    rankTitle: 'Arsitek Logika',
  },
  {
    id: 'peer-6',
    name: 'Bagus Setiawan',
    city: 'Malang',
    xp: 430,
    streakDays: 4,
    complexFormulasMastered: 5,
    weeklyXp: 210,
    rankTitle: 'Analis Formula',
  },
  {
    id: 'peer-7',
    name: 'Dina Oktaviani',
    city: 'Medan',
    xp: 190,
    streakDays: 2,
    complexFormulasMastered: 3,
    weeklyXp: 140,
    rankTitle: 'Pemula Tabel',
  },
];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Fallback handled by localStorage
  }
}

export async function loadProgressState(): Promise<UserProgressState> {
  const fromIdb = await idbGet<UserProgressState>(PROGRESS_KEY);
  if (fromIdb) return { ...DEFAULT_PROGRESS, ...fromIdb };

  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROGRESS;
}

export async function saveProgressState(state: UserProgressState): Promise<void> {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
  await idbSet(PROGRESS_KEY, state);
}
