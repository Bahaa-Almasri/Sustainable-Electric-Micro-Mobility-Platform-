import type { AppPreferences } from '@/types/app-preferences';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  version: 1,
  language: 'en-US',
  themeMode: 'system',
  accessibilityEnabled: false,
  soundsEnabled: true,
  vibrationEnabled: true,
};
