import {
  LANGUAGE_LABELS,
  MAP_BEHAVIOR_LABELS,
  THEME_LABELS,
  UNITS_LABELS,
  VEHICLE_LABELS,
} from '@/lib/preferences/labels';
import type {
  AppLanguage,
  DefaultVehiclePreference,
  MapBehaviorPreference,
  ThemeMode,
  UnitsPreference,
} from '@/types/app-preferences';

export type PickerOption<T extends string = string> = { value: T; label: string };

export const LANGUAGE_PICKER_OPTIONS: PickerOption<AppLanguage>[] = [
  { value: 'en-US', label: LANGUAGE_LABELS['en-US'] },
  { value: 'en-GB', label: LANGUAGE_LABELS['en-GB'] },
  { value: 'ar', label: LANGUAGE_LABELS.ar },
];

export const THEME_PICKER_OPTIONS: PickerOption<ThemeMode>[] = [
  { value: 'light', label: THEME_LABELS.light },
  { value: 'dark', label: THEME_LABELS.dark },
  { value: 'system', label: THEME_LABELS.system },
];

export const UNITS_PICKER_OPTIONS: PickerOption<UnitsPreference>[] = [
  { value: 'metric', label: UNITS_LABELS.metric },
  { value: 'imperial', label: UNITS_LABELS.imperial },
];

export const MAP_BEHAVIOR_PICKER_OPTIONS: PickerOption<MapBehaviorPreference>[] = [
  { value: 'nearest_available', label: MAP_BEHAVIOR_LABELS.nearest_available },
  { value: 'show_all_nearby', label: MAP_BEHAVIOR_LABELS.show_all_nearby },
  { value: 'stations_first', label: MAP_BEHAVIOR_LABELS.stations_first },
];

export const VEHICLE_PICKER_OPTIONS: PickerOption<DefaultVehiclePreference>[] = [
  { value: 'e_scooter', label: VEHICLE_LABELS.e_scooter },
  { value: 'e_bike', label: VEHICLE_LABELS.e_bike },
  { value: 'car', label: VEHICLE_LABELS.car },
];
