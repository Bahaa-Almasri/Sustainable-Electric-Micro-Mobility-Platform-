import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { DEFAULT_APP_PREFERENCES } from '@/lib/preferences/defaults';
import { loadAppPreferences, saveAppPreferences } from '@/lib/preferences/storage';
import type { AppPreferences } from '@/types/app-preferences';

export type PreferencesContextValue = {
  /** Merged persisted + defaults; safe to read for UI. */
  preferences: AppPreferences;
  /** True after first AsyncStorage read completes. */
  hydrated: boolean;
  /** Effective light/dark for UI and navigation (respects system when theme is System). */
  resolvedColorScheme: 'light' | 'dark';
  /** Persist partial updates (merged with current preferences). */
  updatePreferences: (patch: Partial<AppPreferences>) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useRNColorScheme() ?? 'light';
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAppPreferences().then((loaded) => {
      if (!active) return;
      setPreferences(loaded);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const resolvedColorScheme = useMemo((): 'light' | 'dark' => {
    const m = preferences.themeMode;
    if (m === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return m;
  }, [preferences.themeMode, systemScheme]);

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      void saveAppPreferences(next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      hydrated,
      resolvedColorScheme,
      updatePreferences,
    }),
    [preferences, hydrated, resolvedColorScheme, updatePreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}

/** When provider is absent (tests), returns null. */
export function usePreferencesOptional(): PreferencesContextValue | null {
  return useContext(PreferencesContext);
}
