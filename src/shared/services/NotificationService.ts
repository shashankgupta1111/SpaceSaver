import {MMKV} from 'react-native-mmkv';
import {SettingsService} from './SettingsService';
import {StorageService} from './StorageService';
import {SmartCleanupService} from './SmartCleanupService';

const storage = new MMKV({id: 'notifications-storage'});
const LAST_REMINDER_CHECK_KEY = 'last_cleanup_reminder_timestamp';

class NotificationServiceClass {
  /**
   * Evaluates if a scheduled cleanup reminder is due and whether
   * potential reclaimable storage exceeds the user-configured threshold.
   *
   * Safety Guarantee:
   * Only provides a review suggestion to the user.
   * NEVER modifies, compresses, or deletes any files.
   */
  async checkAndScheduleReminder(): Promise<{
    shouldNotify: boolean;
    potentialSavingsBytes: number;
    notificationText?: string;
  }> {
    const frequency = SettingsService.get('cleanupReminders');
    if (frequency === 'off') {
      return {shouldNotify: false, potentialSavingsBytes: 0};
    }

    const threshold = SettingsService.get('reminderThresholdBytes') || 2 * 1024 * 1024 * 1024;
    const now = Date.now();
    const lastCheck = storage.getNumber(LAST_REMINDER_CHECK_KEY) || 0;

    const intervalMs =
      frequency === 'weekly'
        ? 7 * 86400 * 1000
        : 30 * 86400 * 1000;

    if (now - lastCheck < intervalMs) {
      return {shouldNotify: false, potentialSavingsBytes: 0};
    }

    try {
      const summary = await SmartCleanupService.getQuickSummary();
      const potential = summary.totalPotentialSavingsBytes || 0;

      if (potential >= threshold) {
        storage.set(LAST_REMINDER_CHECK_KEY, now);
        const formatted = StorageService.formatBytes(potential);
        const notificationText = `SpaceSaver: You may be able to free up ~${formatted}. Tap to review cleanup.`;

        return {
          shouldNotify: true,
          potentialSavingsBytes: potential,
          notificationText,
        };
      }
    } catch {
      // Fallback
    }

    return {shouldNotify: false, potentialSavingsBytes: 0};
  }

  getLastReminderTimestamp(): number {
    return storage.getNumber(LAST_REMINDER_CHECK_KEY) || 0;
  }
}

export const NotificationService = new NotificationServiceClass();
