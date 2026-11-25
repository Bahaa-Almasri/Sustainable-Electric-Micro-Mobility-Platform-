import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One place for haptic feedback, so every screen uses the same feel for the same kind
 * of action, and the Account › Vibration switch turns all of it off.
 *
 * - selection: picking something (a station pin, a vehicle tab, a battery filter)
 * - light / medium: pressing a control that starts something (tab bar, Stop ride)
 * - success / warning / error: the result of an action (also fired by `toast`)
 *
 * Calls never throw and do nothing on web.
 */

let enabled = true;

/** Called by `PreferencesProvider` whenever the Vibration preference changes. */
export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

function run(fn: () => Promise<void>) {
  if (!enabled || Platform.OS === 'web') return;
  fn().catch(() => {
    /* no haptic engine (simulator, old device): ignore */
  });
}

export const haptics = {
  selection: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
