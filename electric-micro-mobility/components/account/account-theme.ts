import { Platform, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

export const ACCENT = '#FF4B41';

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;

export function accountSurfaces(colorScheme: 'light' | 'dark' | null | undefined) {
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];
  return {
    isDark,
    pageBg: isDark ? palette.background : '#F9F9F9',
    cardBg: isDark ? '#1E2122' : '#FFFFFF',
    elevatedStroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    text: isDark ? palette.text : '#111111',
    muted: isDark ? '#9BA1A6' : '#757575',
    subtle: isDark ? 'rgba(255,255,255,0.5)' : '#9E9E9E',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    searchBg: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F2',
    destructive: '#E53935',
  };
}
