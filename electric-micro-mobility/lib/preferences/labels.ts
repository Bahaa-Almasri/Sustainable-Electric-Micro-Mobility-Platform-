import type {
  AppLanguage,
  DefaultVehiclePreference,
  MapBehaviorPreference,
  ThemeMode,
  UnitsPreference,
} from '@/types/app-preferences';

/** User-facing labels for preference rows (UI + future i18n hooks). */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  ar: 'Arabic',
};

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export const UNITS_LABELS: Record<UnitsPreference, string> = {
  metric: 'Kilometers',
  imperial: 'Miles',
};

export const MAP_BEHAVIOR_LABELS: Record<MapBehaviorPreference, string> = {
  nearest_available: 'Nearest available',
  show_all_nearby: 'Show all nearby',
  stations_first: 'Focus on stations first',
};

export const VEHICLE_LABELS: Record<DefaultVehiclePreference, string> = {
  e_scooter: 'E-scooter',
  e_bike: 'E-bike',
  car: 'Car',
};
