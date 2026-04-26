import type { AppLanguage, ThemeMode } from '@/types/app-preferences';

/** User-facing labels for preference rows (UI + future i18n hooks). */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  'en-US': 'English (US)',
  ar: 'Arabic',
};

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};
