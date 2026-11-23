import { useCallback, useEffect, useState } from 'react';
import { ReminderSettings } from '../types/app';
import { getTodayISO } from '../utils/storage';

export function useDailyReminder(
  settings: ReminderSettings,
  onMarkTriggered: (dateIso: string) => void
) {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [inAppBanner, setInAppBanner] = useState<string | null>(null);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    const res = await Notification.requestPermission();
    setPermission(res);
    return res;
  }, []);

  const triggerNotification = useCallback(
    async (message?: string) => {
      const text =
        message ||
        settings.customMessage ||
        'Waktunya 10 menit latihan rumus Excel harian di RumusLab.';

      setInAppBanner(text);

      if (typeof window !== 'undefined' && 'Notification' in window) {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await requestPermission();
        }
        if (perm === 'granted') {
          try {
            new Notification('Pengingat Latihan RumusLab', {
              body: text,
              icon: '/pwa-192x192.png',
              tag: 'rumuslab-daily-reminder',
            });
          } catch {
            // Fallback to in-app banner if browser blocks constructor
          }
        }
      }
    },
    [settings.customMessage, requestPermission]
  );

  useEffect(() => {
    if (!settings.enabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const todayIso = getTodayISO();
      if (settings.lastTriggeredDate === todayIso) return;

      const dayOfWeek = now.getDay();
      if (!settings.days.includes(dayOfWeek)) return;

      const [targetH, targetM] = settings.time.split(':').map(Number);
      const currentH = now.getHours();
      const currentM = now.getMinutes();

      if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
        onMarkTriggered(todayIso);
        void triggerNotification(settings.customMessage);
      }
    };

    checkSchedule();
    const interval = window.setInterval(checkSchedule, 30000);
    return () => window.clearInterval(interval);
  }, [settings, onMarkTriggered, triggerNotification]);

  return {
    permission,
    inAppBanner,
    dismissBanner: () => setInAppBanner(null),
    requestPermission,
    triggerNotification,
  };
}
