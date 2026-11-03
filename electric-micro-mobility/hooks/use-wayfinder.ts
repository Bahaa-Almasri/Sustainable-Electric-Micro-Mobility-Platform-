import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Current Wayfinder tokens for the active theme. */
export function useWayfinder() {
  const isDark = useColorScheme() === 'dark';
  return { c: isDark ? Palette.dark : Palette.light, isDark };
}

/** Height of the floating tab bar plus its margins; scrolling screens pad their content by this. */
export const TAB_BAR_HEIGHT = 64;

export function useTabBarSpace() {
  const { bottom } = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(bottom, 12) + 28;
}
