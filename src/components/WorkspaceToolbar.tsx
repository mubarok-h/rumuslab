import React from 'react';
import { Bell, Moon, Sun, Wifi, WifiOff, SlidersHorizontal } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { getRankForXp } from '../utils/storage';

interface WorkspaceToolbarProps {
  xp: number;
  streakDays: number;
  learnerName: string;
  isDark: boolean;
  onToggleDark: () => void;
  isOnline: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  onOpenSettings: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  xp,
  streakDays,
  learnerName,
  isDark,
  onToggleDark,
  isOnline,
  reminderEnabled,
  reminderTime,
  onOpenSettings,
}) => {
  const rank = getRankForXp(xp);

  return (
    <div className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
        {/* Left: Unboxed clean metadata */}
        <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-slate-100">{learnerName}</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span>{rank.title}</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
            {xp.toLocaleString('id-ID')} XP
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="tabular-nums">
            Runtutan {streakDays} hari
          </span>
        </div>

        {/* Right: Functional controls */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
              isOnline
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            )}
            <span>{isOnline ? 'Mode Offline Siap' : 'Sedang Offline · Data Lokal Aktif'}</span>
          </span>

          <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Bell className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <span>{reminderEnabled ? `Pengingat ${reminderTime}` : 'Pengaturan & Pengingat'}</span>
            <SlidersHorizontal className="h-3 w-3 opacity-60" aria-hidden="true" />
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
