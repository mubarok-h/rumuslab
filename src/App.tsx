import { useCallback, useEffect, useState } from 'react';
import { BellRing, WifiOff, X } from 'lucide-react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CertificatesView } from './components/CertificatesView';
import { CheatSheetDrawer } from './components/CheatSheetDrawer';
import { CommunityForumView } from './components/CommunityForumView';
import { Header } from './components/Header';
import { LeaderboardView } from './components/LeaderboardView';
import { ReminderOfflineModal } from './components/ReminderOfflineModal';
import { SpreadsheetSimulator } from './components/SpreadsheetSimulator';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { CURRICULUM_MODULES, LEVEL_METADATA } from './data/curriculum';
import { useDailyReminder } from './hooks/useDailyReminder';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  AppTab,
  CertificateRecord,
  ForumThread,
  LessonModule,
  LevelId,
  ReminderSettings,
  UserProgressState,
} from './types/app';
import {
  DEFAULT_PROGRESS,
  INITIAL_FORUM_THREADS,
  getRankForXp,
  getTodayISO,
  loadForumThreads,
  loadProgressState,
  saveForumThreads,
  saveProgressState,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('simulator');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(CURRICULUM_MODULES[0].id);
  const [progress, setProgress] = useState<UserProgressState>(DEFAULT_PROGRESS);
  const [threads, setThreads] = useState<ForumThread[]>(INITIAL_FORUM_THREADS);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [injectedFormula, setInjectedFormula] = useState<{
    formula: string;
    timestamp: number;
    source?: 'forum' | 'cheatsheet';
  } | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const isOnline = useOnlineStatus();

  // Global keyboard shortcuts for Cheat Sheet (Ctrl+K / Cmd+K, Ctrl+/, or ? outside inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 'k' || key === '/')) {
        e.preventDefault();
        setCheatSheetOpen((prev) => !prev);
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !target?.isContentEditable) {
          e.preventDefault();
          setCheatSheetOpen((prev) => !prev);
          return;
        }
      }
      if (e.key === 'Escape' && cheatSheetOpen) {
        setCheatSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cheatSheetOpen]);

  // Load persisted IndexedDB / localStorage state
  useEffect(() => {
    let mounted = true;
    Promise.all([loadProgressState(), loadForumThreads()]).then(([savedProg, savedThreads]) => {
      if (!mounted) return;
      setProgress(savedProg);
      setThreads(savedThreads);
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist progress changes
  useEffect(() => {
    if (!hydrated) return;
    void saveProgressState(progress);
  }, [progress, hydrated]);

  // Persist forum changes
  useEffect(() => {
    if (!hydrated) return;
    void saveForumThreads(threads);
  }, [threads, hydrated]);

  // Sync offline-queued forum items automatically when connectivity returns
  useEffect(() => {
    if (!isOnline || !hydrated) return;
    const hasPending = threads.some(
      (t) => t.pendingSync || t.replies.some((r) => r.pendingSync)
    );
    if (hasPending) {
      setThreads((prev) =>
        prev.map((t) => ({
          ...t,
          pendingSync: false,
          replies: t.replies.map((r) => ({ ...r, pendingSync: false })),
        }))
      );
      setProgress((prev) => ({ ...prev, offlineSyncQueueCount: 0 }));
    }
  }, [isOnline, hydrated, threads]);

  const handleToggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('rumuslab_theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleMarkReminderTriggered = useCallback((dateIso: string) => {
    setProgress((prev) => ({
      ...prev,
      reminder: {
        ...prev.reminder,
        lastTriggeredDate: dateIso,
      },
    }));
  }, []);

  const {
    permission,
    inAppBanner,
    dismissBanner,
    requestPermission,
    triggerNotification,
  } = useDailyReminder(progress.reminder, handleMarkReminderTriggered);

  const handleRecordAttempt = useCallback((isCorrect: boolean) => {
    const today = getTodayISO();
    setProgress((prev) => {
      const existingLog = prev.dailyLogs[today] ?? {
        date: today,
        minutesSpent: 0,
        exercisesCompleted: 0,
        xpEarned: 0,
        attempts: 0,
        correctAttempts: 0,
      };
      return {
        ...prev,
        totalAttempts: prev.totalAttempts + 1,
        correctAttempts: prev.correctAttempts + (isCorrect ? 1 : 0),
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: {
            ...existingLog,
            attempts: existingLog.attempts + 1,
            correctAttempts: existingLog.correctAttempts + (isCorrect ? 1 : 0),
          },
        },
      };
    });
  }, []);

  const handleCompleteModule = useCallback((mod: LessonModule, elapsedSeconds: number) => {
    const today = getTodayISO();
    setProgress((prev) => {
      const alreadyDone = prev.completedModuleIds.includes(mod.id);
      const nextCompleted = alreadyDone
        ? prev.completedModuleIds
        : [...prev.completedModuleIds, mod.id];

      const earnedXp = alreadyDone ? 0 : mod.xpReward;
      const nextXp = prev.xp + earnedXp;

      const nextFunctions = Array.from(
        new Set([...prev.masteredFunctions, ...mod.functionsCovered])
      );

      // Update streak if first activity today
      let nextStreak = prev.streakDays;
      if (prev.lastActiveDate !== today) {
        const prevDate = new Date(prev.lastActiveDate);
        const currDate = new Date(today);
        const diffDays = Math.round(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        nextStreak = diffDays === 1 ? prev.streakDays + 1 : 1;
      }

      const existingLog = prev.dailyLogs[today] ?? {
        date: today,
        minutesSpent: 0,
        exercisesCompleted: 0,
        xpEarned: 0,
        attempts: 0,
        correctAttempts: 0,
      };

      const addedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

      // Check level completion certificates
      const nextCerts: Record<number, CertificateRecord> = { ...prev.certificates };
      ([1, 2, 3, 4] as LevelId[]).forEach((lvl) => {
        const lvlMods = CURRICULUM_MODULES.filter((m) => m.level === lvl);
        const allDone =
          lvlMods.length > 0 && lvlMods.every((m) => nextCompleted.includes(m.id));
        if (allDone && !nextCerts[lvl]) {
          const acc =
            prev.totalAttempts > 0
              ? Math.round((prev.correctAttempts / prev.totalAttempts) * 100)
              : 100;
          nextCerts[lvl] = {
            id: `RL-L${lvl}-${String(nextXp).padStart(4, '0')}`,
            level: lvl,
            levelTitle: LEVEL_METADATA[lvl].title,
            learnerName: prev.learnerName,
            issuedAt: today,
            accuracyPercent: acc,
            completedModules: lvlMods.length,
          };
        }
      });

      return {
        ...prev,
        xp: nextXp,
        streakDays: nextStreak,
        lastActiveDate: today,
        completedModuleIds: nextCompleted,
        masteredFunctions: nextFunctions,
        totalSecondsPracticed: prev.totalSecondsPracticed + elapsedSeconds,
        certificates: nextCerts,
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: {
            ...existingLog,
            minutesSpent: existingLog.minutesSpent + addedMinutes,
            exercisesCompleted: existingLog.exercisesCompleted + (alreadyDone ? 0 : 1),
            xpEarned: existingLog.xpEarned + earnedXp,
          },
        },
      };
    });
  }, []);

  const handleStartDailyPractice = () => {
    const nextTodo =
      CURRICULUM_MODULES.find((m) => !progress.completedModuleIds.includes(m.id)) ??
      CURRICULUM_MODULES[0];
    setSelectedModuleId(nextTodo.id);
    setActiveTab('simulator');
  };

  const handleJumpToModule = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setActiveTab('simulator');
  };

  const handleUpdateLearnerName = (name: string) => {
    setProgress((prev) => {
      const updatedCerts: Record<number, CertificateRecord> = {};
      Object.entries(prev.certificates).forEach(([k, cert]) => {
        updatedCerts[Number(k)] = { ...cert, learnerName: name };
      });
      return {
        ...prev,
        learnerName: name,
        certificates: updatedCerts,
      };
    });
  };

  const handleUpdateReminder = (next: ReminderSettings) => {
    setProgress((prev) => ({ ...prev, reminder: next }));
  };

  const handleCreateThread = (
    draft: Omit<ForumThread, 'id' | 'createdAt' | 'upvotes' | 'replies'>
  ) => {
    const created: ForumThread = {
      ...draft,
      id: `thread-${Date.now()}`,
      createdAt: 'Baru saja',
      upvotes: 1,
      upvotedByMe: true,
      replies: [],
    };
    setThreads((prev) => [created, ...prev]);
    if (!isOnline) {
      setProgress((prev) => ({
        ...prev,
        offlineSyncQueueCount: prev.offlineSyncQueueCount + 1,
      }));
    }
  };

  const handleAddReply = (threadId: string, body: string, formulaSnippet?: string) => {
    const rankTitle = getRankForXp(progress.xp).title;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          replies: [
            ...t.replies,
            {
              id: `rep-${Date.now()}`,
              author: progress.learnerName,
              authorRank: rankTitle,
              createdAt: 'Baru saja',
              body,
              formulaSnippet,
              upvotes: 0,
              pendingSync: !isOnline,
            },
          ],
        };
      })
    );
    if (!isOnline) {
      setProgress((prev) => ({
        ...prev,
        offlineSyncQueueCount: prev.offlineSyncQueueCount + 1,
      }));
    }
  };

  const handleToggleUpvoteThread = (threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const already = Boolean(t.upvotedByMe);
        return {
          ...t,
          upvotedByMe: !already,
          upvotes: already ? Math.max(0, t.upvotes - 1) : t.upvotes + 1,
        };
      })
    );
  };

  const handleTryFormulaInSimulator = (formula: string, presetModuleId?: string) => {
    if (presetModuleId) {
      setSelectedModuleId(presetModuleId);
    }
    setActiveTab('simulator');
    setInjectedFormula({ formula, timestamp: Date.now(), source: 'forum' });
  };

  const handleInsertFromCheatSheet = (formula: string) => {
    setActiveTab('simulator');
    setInjectedFormula({ formula, timestamp: Date.now(), source: 'cheatsheet' });
  };

  const activeModuleFunctions =
    CURRICULUM_MODULES.find((m) => m.id === selectedModuleId)?.functionsCovered ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onStartDailyPractice={handleStartDailyPractice}
      />

      <WorkspaceToolbar
        xp={progress.xp}
        streakDays={progress.streakDays}
        learnerName={progress.learnerName}
        isDark={isDark}
        onToggleDark={handleToggleDark}
        isOnline={isOnline}
        reminderEnabled={progress.reminder.enabled}
        reminderTime={progress.reminder.time}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Active Daily Reminder In-App Alert */}
      {inAppBanner && (
        <div
          role="alert"
          className="border-b border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/60 dark:text-teal-100"
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 sm:px-2">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <span>
                <strong>Pengingat Harian:</strong> {inAppBanner}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleStartDailyPractice();
                  dismissBanner();
                }}
                className="rounded bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                Latihan Sekarang
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Tutup pengingat"
                className="rounded p-1 text-teal-800 hover:bg-teal-200/60 dark:text-teal-200 dark:hover:bg-teal-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        {activeTab === 'simulator' && (
          <SpreadsheetSimulator
            selectedModuleId={selectedModuleId}
            onSelectModuleId={setSelectedModuleId}
            completedModuleIds={progress.completedModuleIds}
            onCompleteModule={handleCompleteModule}
            onRecordAttempt={handleRecordAttempt}
            injectedFormula={injectedFormula}
            onOpenCheatSheet={() => setCheatSheetOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard progress={progress} onJumpToModule={handleJumpToModule} />
        )}

        {activeTab === 'certificates' && (
          <CertificatesView progress={progress} onJumpToModule={handleJumpToModule} />
        )}

        {activeTab === 'leaderboard' && <LeaderboardView progress={progress} />}

        {activeTab === 'community' && (
          <CommunityForumView
            threads={threads}
            learnerName={progress.learnerName}
            learnerXp={progress.xp}
            isOnline={isOnline}
            onCreateThread={handleCreateThread}
            onAddReply={handleAddReply}
            onToggleUpvoteThread={handleToggleUpvoteThread}
            onTryFormulaInSimulator={handleTryFormulaInSimulator}
          />
        )}
      </main>

      {/* Non-intrusive Offline Toast */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <WifiOff className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <span>Mode Offline — Seluruh modul, simulator, & progres tersimpan lokal.</span>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            RumusLab · Platform Simulasi Fungsi Excel Interaktif & Pembelajaran Offline
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Atur Pengingat Harian
            </button>
            <button
              type="button"
              onClick={handleToggleDark}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              {isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            </button>
          </div>
        </div>
      </footer>

      <ReminderOfflineModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        learnerName={progress.learnerName}
        onUpdateLearnerName={handleUpdateLearnerName}
        reminder={progress.reminder}
        onUpdateReminder={handleUpdateReminder}
        permission={permission}
        onRequestPermission={requestPermission}
        onTestNotification={() => triggerNotification()}
        isOnline={isOnline}
        offlineQueueCount={progress.offlineSyncQueueCount}
      />

      <CheatSheetDrawer
        isOpen={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
        highlightedFunctions={activeTab === 'simulator' ? activeModuleFunctions : []}
        canInsertToCell={activeTab === 'simulator'}
        onInsertFormula={handleInsertFromCheatSheet}
      />
    </div>
  );
}
