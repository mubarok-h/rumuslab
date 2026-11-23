import React, { useState } from 'react';
import { Bell, CheckCircle2, HardDrive, Send, User, Wifi, WifiOff, X } from 'lucide-react';
import { ReminderSettings } from '../types/app';
import { CURRICULUM_MODULES, FORMULA_CATALOG } from '../data/curriculum';

interface ReminderOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnerName: string;
  onUpdateLearnerName: (name: string) => void;
  reminder: ReminderSettings;
  onUpdateReminder: (next: ReminderSettings) => void;
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  onTestNotification: () => Promise<void>;
  isOnline: boolean;
}

const DAY_LABELS = [
  { id: 1, short: 'Sen' },
  { id: 2, short: 'Sel' },
  { id: 3, short: 'Rab' },
  { id: 4, short: 'Kam' },
  { id: 5, short: 'Jum' },
  { id: 6, short: 'Sab' },
  { id: 0, short: 'Min' },
];

export const ReminderOfflineModal: React.FC<ReminderOfflineModalProps> = ({
  isOpen,
  onClose,
  learnerName,
  onUpdateLearnerName,
  reminder,
  onUpdateReminder,
  permission,
  onRequestPermission,
  onTestNotification,
  isOnline,
}) => {
  const [nameInput, setNameInput] = useState(learnerName);
  const [testSent, setTestSent] = useState(false);

  if (!isOpen) return null;

  const toggleDay = (dayId: number) => {
    const exists = reminder.days.includes(dayId);
    const nextDays = exists
      ? reminder.days.filter((d) => d !== dayId)
      : [...reminder.days, dayId];
    onUpdateReminder({ ...reminder, days: nextDays });
  };

  const handleToggleEnabled = async () => {
    const nextEnabled = !reminder.enabled;
    if (nextEnabled && permission === 'default') {
      await onRequestPermission();
    }
    onUpdateReminder({ ...reminder, enabled: nextEnabled });
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim();
    if (cleaned) {
      onUpdateLearnerName(cleaned);
    }
  };

  const handleTest = async () => {
    await onTestNotification();
    setTestSent(true);
    window.setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-settings-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="modal-settings-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              Pengaturan Profil, Notifikasi Harian & Mode Offline
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Sesuaikan nama untuk sertifikat, jadwal pengingat latihan, dan status penyimpanan lokal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Learner Profile */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <label
              htmlFor="learner-name-input"
              className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              <User className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              Nama Lengkap (untuk Sertifikat & Peringkat)
            </label>
            <div className="flex gap-2">
              <input
                id="learner-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Masukkan nama lengkap Anda"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
              >
                Simpan Nama
              </button>
            </div>
          </form>

          {/* Daily Reminder Scheduler */}
          <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Bell className="mt-0.5 h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notifikasi Pengingat Latihan Harian
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Status izin browser:{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {permission === 'granted'
                        ? 'Diizinkan'
                        : permission === 'denied'
                          ? 'Diblokir (gunakan pengingat di dalam aplikasi)'
                          : 'Belum Diminta'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleEnabled()}
                role="switch"
                aria-checked={reminder.enabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  reminder.enabled ? 'bg-teal-700 dark:bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    reminder.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="reminder-time"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Jam Pengingat
                </label>
                <input
                  id="reminder-time"
                  type="time"
                  value={reminder.time}
                  onChange={(e) => onUpdateReminder({ ...reminder, time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hari Aktif
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DAY_LABELS.map((d) => {
                    const active = reminder.days.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-teal-700 text-white dark:bg-teal-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="reminder-message"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Pesan Pengingat
              </label>
              <input
                id="reminder-message"
                type="text"
                value={reminder.customMessage}
                onChange={(e) =>
                  onUpdateReminder({ ...reminder, customMessage: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleTest()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Send className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                Uji Notifikasi Sekarang
              </button>
              {testSent && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Notifikasi uji coba terkirim
                </span>
              )}
            </div>
          </div>

          {/* Offline Pack & Cache Readiness */}
          <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ketersediaan Akses Offline (PWA & IndexedDB)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                {isOnline ? (
                  <Wifi className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                )}
                {isOnline ? 'Terhubung' : 'Mode Offline'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Modul & Kasus</div>
                <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {CURRICULUM_MODULES.length} Tersimpan
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Katalog Rumus</div>
                <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {FORMULA_CATALOG.length} Fungsi
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Seluruh simulator rumus, studi kasus, latihan mandiri, sertifikat, dan progres harian tersimpan lokal melalui Service Worker dan IndexedDB agar dapat dipelajari kapan saja tanpa internet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
