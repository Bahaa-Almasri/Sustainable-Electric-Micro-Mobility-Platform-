import { Platform, type ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';

export const ACCENT = Palette.light.accent;

export const cardShadow: ViewStyle = Platform.select({ default: {} }) as ViewStyle;

export function accountSurfaces(colorScheme: 'light' | 'dark' | null | undefined) {
  const isDark = colorScheme === 'dark';
  const c = isDark ? Palette.dark : Palette.light;
  return {
    isDark,
    pageBg: c.bg,
    cardBg: c.surface,
    elevatedStroke: c.line,
    text: c.text,
    muted: c.muted,
    subtle: c.muted,
    divider: c.line,
    searchBg: 'transparent',
    destructive: c.accentText,
  };
}
