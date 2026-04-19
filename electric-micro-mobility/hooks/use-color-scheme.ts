import { useColorScheme as useRNColorScheme } from 'react-native';

import { usePreferencesOptional } from '@/contexts/preferences-context';

/**
 * App color scheme: respects **Preferences → Theme** (Light / Dark / System).
 * Falls back to system `useColorScheme` when used outside `PreferencesProvider`.
 */
export function useColorScheme(): 'light' | 'dark' | null {
  const prefs = usePreferencesOptional();
  const system = useRNColorScheme();
  if (!prefs) return system ?? 'light';
  return prefs.resolvedColorScheme;
}

/** Raw device appearance (ignores user theme preference). For maps, splash, etc. */
export function useSystemColorScheme(): ReturnType<typeof useRNColorScheme> {
  return useRNColorScheme();
}
