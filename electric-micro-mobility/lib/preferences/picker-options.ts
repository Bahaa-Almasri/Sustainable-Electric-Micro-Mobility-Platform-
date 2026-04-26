import { LANGUAGE_LABELS, THEME_LABELS } from '@/lib/preferences/labels';
import type { AppLanguage, ThemeMode } from '@/types/app-preferences';

export type PickerOption<T extends string = string> = { value: T; label: string };

export const LANGUAGE_PICKER_OPTIONS: PickerOption<AppLanguage>[] = [
  { value: 'en-US', label: LANGUAGE_LABELS['en-US'] },
  { value: 'ar', label: LANGUAGE_LABELS.ar },
];

export const THEME_PICKER_OPTIONS: PickerOption<ThemeMode>[] = [
  { value: 'light', label: THEME_LABELS.light },
  { value: 'dark', label: THEME_LABELS.dark },
  { value: 'system', label: THEME_LABELS.system },
];
