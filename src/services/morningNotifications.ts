import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UserPreferences } from '../types/market';

const NOTIFICATION_ID_KEY = 'morning_briefing_notification';

/**
 * Requests notification permissions on iOS (Android grants by default on install).
 * Returns true if permissions are granted or already granted.
 */
async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return true;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Cancels any previously scheduled morning briefing notification.
 */
async function cancelMorningNotification(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter(
    (n) => n.identifier.startsWith(NOTIFICATION_ID_KEY),
  );
  await Promise.all(existing.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Schedules a daily repeating notification at the time specified in preferences.
 * If morningAlertEnabled is false, only cancels any existing notification.
 */
export async function syncMorningBriefingNotification(
  preferences: UserPreferences,
): Promise<void> {
  // Always cancel the old schedule first so we start clean
  await cancelMorningNotification();

  if (!preferences.morningAlertEnabled) {
    return;
  }

  const granted = await requestPermissions();
  if (!granted) {
    return;
  }

  // Parse "HH:MM" time string
  const [hourStr, minuteStr] = preferences.morningAlertTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (isNaN(hour) || isNaN(minute)) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIFICATION_ID_KEY}_daily`,
    content: {
      title: '📈 모닝 마켓 브리핑',
      body: '오늘의 시장 동향을 확인하세요.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
