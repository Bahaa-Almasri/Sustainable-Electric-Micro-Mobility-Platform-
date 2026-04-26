/** Stored app preferences (local-first; ready for future server sync). */

export type AppLanguage = 'en-US' | 'ar';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AppPreferences = {
  /** Schema version for migrations. */
  version: number;
  language: AppLanguage;
  themeMode: ThemeMode;
  /** Larger touch targets, higher contrast — future: scale factors, reduce motion. */
  accessibilityEnabled: boolean;
  /** Ride / UI sounds — future: `SoundService` respects this. */
  soundsEnabled: boolean;
  /** Haptic feedback — future: `HapticsService` respects this. */
  vibrationEnabled: boolean;
};
