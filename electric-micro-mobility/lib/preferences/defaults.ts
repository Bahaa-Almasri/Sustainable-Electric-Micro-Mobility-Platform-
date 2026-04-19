import type { AppPreferences } from '@/types/app-preferences';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  version: 1,
  language: 'en-US',
  themeMode: 'system',
  units: 'metric',
  mapBehavior: 'nearest_available',
  defaultVehicle: 'e_scooter',
  accessibilityEnabled: false,
  soundsEnabled: true,
  vibrationEnabled: true,
};
