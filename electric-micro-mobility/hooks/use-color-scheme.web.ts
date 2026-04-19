import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { usePreferencesOptional } from '@/contexts/preferences-context';

/**
 * Web: respects static render first, then **Preferences → Theme** once hydrated (like native).
 */
export function useColorScheme(): 'light' | 'dark' | null {
  const [hasHydrated, setHasHydrated] = useState(false);
  const prefs = usePreferencesOptional();
  const system = useRNColorScheme() ?? 'light';

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  if (!prefs) return system;
  return prefs.resolvedColorScheme;
}
