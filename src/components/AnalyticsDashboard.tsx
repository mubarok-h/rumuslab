import React, { useMemo, useState } from 'react';
import { Award, Calendar, CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';
import { CURRICULUM_MODULES, FORMULA_CATALOG, LEVEL_METADATA } from '../data/curriculum';
import { LevelId, UserProgressState } from '../types/app';
import { getDateOffsetISO, getRankForXp } from '../utils/storage';

interface AnalyticsDashboardProps {
  progress: UserProgressState;
  onJumpToModule: (moduleId: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  progress,
  onJumpToModule,
}) => {
  const [rangeDays, setRangeDays] = useState<14 | 28>(14);

  const accuracy =
    progress.totalAttempts > 0
      ? Math.round((progress.correctAttempts / progress.totalAttempts) * 100)
      : 100;

  const totalMinutes = Math.round(progress.totalSecondsPracticed / 60);
  const rank = getRankForXp(progress.xp);

  const dailySeries = useMemo(() => {
    const arr = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = getDateOffsetISO(i);
      const log = progress.dailyLogs[date];
      arr.push({
        date,
        label: date.slice(5), // MM-DD
        xp: log?.xpEarned ?? 0,
        minutes: log?.minutesSpent ?? 0,
        exercises: log?.exercisesCompleted ?? 0,
      });
    }
    return arr;
  }, [progress.dailyLogs, rangeDays]);

  const maxXpInSeries = Math.max(100, ...dailySeries.map((d) => d.xp));

  const categoryBreakdown = useMemo(() => {
    const levels: LevelId[] = [1, 2, 3, 4];
    return levels.map((lvl) => {
      const mods = CURRICULUM_MODULES.filter((m) => m.level === lvl);
      const done = mods.filter((m) => progress.completedModuleIds.includes(m.id));
      const pct = mods.length > 0 ? Math.round((done.length / mods.length) * 100) : 0;
      const nextTodo = mods.find((m) => !progress.completedModuleIds.includes(m.id));
      const fnsInCat = FORMULA_CATALOG.filter((f) =>
        lvl === 1
          ? f.category === 'Dasar' || f.category === 'Statistical'
          : lvl === 2
            ? f.category === 'Logika'
            : lvl === 3
              ? f.category === 'Teks & Tanggal'
              : f.category === 'Pencarian' || f.category === 'Financial'
      );
      const masteredInCat = fnsInCat.filter((f) =>
        progress.masteredFunctions.includes(f.name)
      );
      return {
        level: lvl,
        meta: LEVEL_METADATA[lvl],
        total: mods.length,
        doneCount: done.length,
        pct,
        nextTodo,
        fnsCount: fnsInCat.length,
        masteredCount: masteredInCat.length,
      };
    });
  }, [progress.completedModuleIds, progress.masteredFunctions]);

  const recentLogs = useMemo(() => {
    return Object.values(progress.dailyLogs)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [progress.dailyLogs]);

  return (
    <section aria-label="Analitik dan Pelacakan Progres Belajar" className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pelacakan Progres & Analitik Belajar
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pantau konsistensi harian, ketepatan penulisan rumus, dan penguasaan tiap kategori fungsi Excel.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setRangeDays(14)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              rangeDays === 14
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            14 Hari Terakhir
          </button>
          <button
            type="button"
            onClick={() => setRangeDays(28)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              rangeDays === 28
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            28 Hari Terakhir
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Konsistensi Harian</span>
            <Calendar className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {progress.streakDays} <span className="text-base font-medium text-slate-500">hari</span>
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Aktif terakhir {progress.lastActiveDate}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Akurasi Penulisan Rumus</span>
            <Target className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {accuracy}%
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {progress.correctAttempts} tepat dari {progress.totalAttempts} percobaan
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Modul & Kasus Selesai</span>
            <CheckCircle2 className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {progress.completedModuleIds.length}
            <span className="text-base font-medium text-slate-500">
              /{CURRICULUM_MODULES.length}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {progress.masteredFunctions.length} fungsi dikuasai
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Peringkat & Durasi Latihan</span>
            <Clock className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalMinutes} <span className="text-base font-medium text-slate-500">menit</span>
          </div>
          <div className="mt-1 text-xs text-teal-700 dark:text-teal-400 font-medium">
            {rank.title} · {progress.xp.toLocaleString('id-ID')} XP
          </div>
        </div>
      </div>

      {/* Daily XP Chart + Category Mastery */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Grafik Aktivitas XP Harian ({rangeDays} Hari)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setiap batang merepresentasikan perolehan XP harian dari studi kasus dan latihan mandiri.
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>

          <div className="mt-6">
            <div className="flex h-48 items-end gap-1.5 sm:gap-2">
              {dailySeries.map((day) => {
                const heightPct = day.xp > 0 ? Math.max(8, Math.round((day.xp / maxXpInSeries) * 100)) : 3;
                return (
                  <div
                    key={day.date}
                    className="group relative flex flex-1 flex-col items-center justify-end h-full"
                  >
                    <div
                      title={`${day.date}: ${day.xp} XP · ${day.minutes} menit · ${day.exercises} latihan`}
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-opacity ${
                        day.xp > 0
                          ? 'bg-teal-700 hover:opacity-85 dark:bg-teal-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <span>{dailySeries[0]?.label}</span>
              <span>{dailySeries[Math.floor(dailySeries.length / 2)]?.label}</span>
              <span>{dailySeries[dailySeries.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        {/* Category Mastery */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Penguasaan Per Level
            </h2>
            <Award className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>

          <div className="mt-5 space-y-5">
            {categoryBreakdown.map((cat) => (
              <div key={cat.level} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {cat.meta.title}
                  </span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {cat.doneCount}/{cat.total} ({cat.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-teal-700 transition-all dark:bg-teal-500"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Fokus: {cat.meta.focus}</span>
                  {cat.nextTodo ? (
                    <button
                      type="button"
                      onClick={() => onJumpToModule(cat.nextTodo!.id)}
                      className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                    >
                      Lanjutkan Latihan
                    </button>
                  ) : (
                    <span className="font-medium text-teal-700 dark:text-teal-400">
                      Level Tuntas
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Study Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Catatan Sesi Belajar Harian
          </h2>
        </div>
        {recentLogs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            Belum ada catatan belajar. Selesaikan latihan pertama Anda di menu Simulasi!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <tr>
                  <th className="px-6 py-3 font-semibold">Tanggal</th>
                  <th className="px-6 py-3 text-right font-semibold">Durasi</th>
                  <th className="px-6 py-3 text-right font-semibold">Latihan Selesai</th>
                  <th className="px-6 py-3 text-right font-semibold">Akurasi</th>
                  <th className="px-6 py-3 text-right font-semibold">XP Diperoleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentLogs.map((log) => {
                  const dayAcc =
                    log.attempts > 0
                      ? Math.round((log.correctAttempts / log.attempts) * 100)
                      : 100;
                  return (
                    <tr
                      key={log.date}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-slate-900 dark:text-slate-100">
                        {log.date}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {log.minutesSpent} mnt
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {log.exercisesCompleted}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {dayAcc}%
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                        +{log.xpEarned} XP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
