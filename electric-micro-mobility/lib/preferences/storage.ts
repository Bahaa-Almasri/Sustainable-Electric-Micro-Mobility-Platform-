import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_APP_PREFERENCES } from '@/lib/preferences/defaults';
import type { AppPreferences } from '@/types/app-preferences';

const STORAGE_KEY = '@eco_mobility/app_preferences_v1';

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Narrows persisted JSON to known keys only (safe merge). */
function parseStored(raw: unknown): Partial<AppPreferences> {
  if (!isObject(raw)) return {};
  const o = raw;
  const out: Partial<AppPreferences> = {};
  if (typeof o.version === 'number') out.version = o.version;
  if (o.language === 'en-US' || o.language === 'en-GB' || o.language === 'ar') {
    out.language = o.language;
  }
  if (o.themeMode === 'light' || o.themeMode === 'dark' || o.themeMode === 'system') {
    out.themeMode = o.themeMode;
  }
  if (o.units === 'metric' || o.units === 'imperial') out.units = o.units;
  if (
    o.mapBehavior === 'nearest_available' ||
    o.mapBehavior === 'show_all_nearby' ||
    o.mapBehavior === 'stations_first'
  ) {
    out.mapBehavior = o.mapBehavior;
  }
  if (o.defaultVehicle === 'e_scooter' || o.defaultVehicle === 'e_bike' || o.defaultVehicle === 'car') {
    out.defaultVehicle = o.defaultVehicle;
  }
  if (typeof o.accessibilityEnabled === 'boolean') out.accessibilityEnabled = o.accessibilityEnabled;
  if (typeof o.soundsEnabled === 'boolean') out.soundsEnabled = o.soundsEnabled;
  if (typeof o.vibrationEnabled === 'boolean') out.vibrationEnabled = o.vibrationEnabled;
  return out;
}

export function mergePreferences(overrides: Partial<AppPreferences>): AppPreferences {
  return { ...DEFAULT_APP_PREFERENCES, ...overrides };
}

export async function loadAppPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    const partial = parseStored(parsed);
    return mergePreferences(partial);
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export async function saveAppPreferences(next: AppPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[preferences] save failed', e);
  }
}

