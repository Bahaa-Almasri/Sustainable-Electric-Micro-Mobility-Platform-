/** Stored app preferences (local-first; ready for future server sync). */

export type AppLanguage = 'en-US' | 'en-GB' | 'ar';

export type ThemeMode = 'light' | 'dark' | 'system';

/** Distance / speed units. */
export type UnitsPreference = 'metric' | 'imperial';

export type MapBehaviorPreference =
  | 'nearest_available'
  | 'show_all_nearby'
  | 'stations_first';

export type DefaultVehiclePreference = 'e_scooter' | 'e_bike' | 'car';

export type AppPreferences = {
  /** Schema version for migrations. */
  version: number;
  language: AppLanguage;
  themeMode: ThemeMode;
  units: UnitsPreference;
  mapBehavior: MapBehaviorPreference;
  defaultVehicle: DefaultVehiclePreference;
  /** Larger touch targets, higher contrast — future: scale factors, reduce motion. */
  accessibilityEnabled: boolean;
  /** Ride / UI sounds — future: `SoundService` respects this. */
  soundsEnabled: boolean;
  /** Haptic feedback — future: `HapticsService` respects this. */
  vibrationEnabled: boolean;
};
