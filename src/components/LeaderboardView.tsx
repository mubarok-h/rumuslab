import React, { useMemo, useState } from 'react';
import { Award, Medal, Search, Trophy } from 'lucide-react';
import { LeaderboardUser, UserProgressState } from '../types/app';
import {
  GAMIFICATION_RANKS,
  INITIAL_LEADERBOARD_PEERS,
  getRankForXp,
  getTodayISO,
} from '../utils/storage';

interface LeaderboardViewProps {
  progress: UserProgressState;
}

type BoardFilter = 'all' | 'weekly' | 'complex';

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ progress }) => {
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [search, setSearch] = useState('');

  const currentRank = getRankForXp(progress.xp);
  const nextRank = GAMIFICATION_RANKS.find((r) => r.minXp > progress.xp);
  const pctToNext = nextRank
    ? Math.min(
        100,
        Math.round(
          ((progress.xp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100
        )
      )
    : 100;

  const todayXp = progress.dailyLogs[getTodayISO()]?.xpEarned ?? 0;

  const rankedUsers = useMemo(() => {
    const complexFuncs = ['IF', 'AND', 'SUMIF', 'COUNTIF', 'VLOOKUP', 'XLOOKUP', 'IFERROR', 'SUMIFS', 'MID'];
    const masteredComplex = progress.masteredFunctions.filter((fn) =>
      complexFuncs.includes(fn)
    ).length;

    const currentUserEntry: LeaderboardUser = {
      id: 'me',
      name: progress.learnerName,
      city: 'Anda',
      xp: progress.xp,
      streakDays: progress.streakDays,
      complexFormulasMastered: masteredComplex,
      weeklyXp: Math.max(todayXp, Math.min(progress.xp, 180 + todayXp)),
      rankTitle: currentRank.title,
      isCurrentUser: true,
    };

    const merged: LeaderboardUser[] = [...INITIAL_LEADERBOARD_PEERS, currentUserEntry];

    merged.sort((a, b) => {
      if (filter === 'weekly') return b.weeklyXp - a.weeklyXp;
      if (filter === 'complex') return b.complexFormulasMastered - a.complexFormulasMastered;
      return b.xp - a.xp;
    });

    return merged;
  }, [progress, filter, currentRank.title, todayXp]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rankedUsers
      .map((u, idx) => ({ ...u, position: idx + 1 }))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q));
  }, [rankedUsers, search]);

  const myPosition = rankedUsers.findIndex((u) => u.isCurrentUser) + 1;

  return (
    <section aria-label="Peringkat Gamifikasi dan Leaderboard" className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Sistem Peringkat Gamifikasi & Leaderboard
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Kumpulkan XP dari setiap studi kasus dan latihan mandiri untuk naik peringkat dan bersaing dalam penguasaan rumus kompleks.
        </p>
      </div>

      {/* Gamification Rank Ladder */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Peringkat Anda Saat Ini · Posisi #{myPosition} di Leaderboard
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
              {currentRank.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {currentRank.description}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
              {progress.xp.toLocaleString('id-ID')} XP
            </div>
            {nextRank ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {(nextRank.minXp - progress.xp).toLocaleString('id-ID')} XP lagi menuju {nextRank.title}
              </div>
            ) : (
              <div className="text-xs font-medium text-teal-700 dark:text-teal-400">
                Peringkat Tertinggi Tercapai
              </div>
            )}
          </div>
        </div>

        {/* Progress bar to next rank */}
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-teal-700 transition-all dark:bg-teal-500"
            style={{ width: `${pctToNext}%` }}
          />
        </div>

        {/* All 5 Tiers */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {GAMIFICATION_RANKS.map((tier, idx) => {
            const unlocked = progress.xp >= tier.minXp;
            const isCurrent = tier.id === currentRank.id;
            return (
              <div
                key={tier.id}
                className={`rounded-lg border p-3.5 text-xs ${
                  isCurrent
                    ? 'border-teal-700 bg-teal-50/60 dark:border-teal-500 dark:bg-teal-950/30'
                    : unlocked
                      ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      : 'border-slate-200/70 bg-slate-50/70 opacity-70 dark:border-slate-800/60 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    Tier {idx + 1}
                  </span>
                  {unlocked && (
                    <Medal className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                  )}
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {tier.title}
                </div>
                <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {tier.minXp.toLocaleString('id-ID')}+ XP
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Controls & Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Semua Level
            </button>
            <button
              type="button"
              onClick={() => setFilter('weekly')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'weekly'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Pekan Ini
            </button>
            <button
              type="button"
              onClick={() => setFilter('complex')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'complex'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Master Rumus Kompleks
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pembelajar atau kota..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <tr>
                <th className="px-6 py-3 font-semibold">Peringkat</th>
                <th className="px-6 py-3 font-semibold">Pembelajar</th>
                <th className="px-6 py-3 font-semibold">Gelar</th>
                <th className="px-6 py-3 text-right font-semibold">Rumus Kompleks</th>
                <th className="px-6 py-3 text-right font-semibold">Runtutan</th>
                <th className="px-6 py-3 text-right font-semibold">
                  {filter === 'weekly' ? 'XP Pekan Ini' : 'Total XP'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((user) => (
                <tr
                  key={user.id}
                  className={
                    user.isCurrentUser
                      ? 'bg-teal-50/70 dark:bg-teal-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }
                >
                  <td className="px-6 py-3.5 font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                    <span className="inline-flex items-center gap-1.5">
                      {user.position === 1 && (
                        <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      )}
                      {user.position === 2 && (
                        <Award className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      )}
                      {user.position === 3 && (
                        <Award className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      )}
                      #{user.position}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {user.name}{' '}
                      {user.isCurrentUser && (
                        <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                          (Anda)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{user.city}</div>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                    {user.rankTitle}
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    {user.complexFormulasMastered} fungsi
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    {user.streakDays} hari
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs font-bold tabular-nums text-teal-700 dark:text-teal-400">
                    {(filter === 'weekly' ? user.weeklyXp : user.xp).toLocaleString('id-ID')} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
